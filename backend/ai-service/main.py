"""
Brain Tumor AI Pipeline — FastAPI Inference Server
===================================================
Implements the full 4-stage pipeline described in Pipeline_Integration_Guide.pdf:
  Stage 1: Classification  (EfficientNetB0 + temperature calibration)
  Stage 2: Segmentation    (U-Net)
  Stage 3: Size & Location extraction (OpenCV, rule-based)
  Stage 4: Treatment suggestion (3x XGBoost)

All models are loaded ONCE at startup (~200 MB RAM, 5-10s).
Thread safety: TensorFlow predictions are wrapped in a lock.
"""

import os
import io
import json
import base64
import threading
import logging

import cv2
import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sklearn.preprocessing import LabelEncoder

# ──────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "..", "models")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

app = FastAPI(
    title="BrainScanAI Inference Server",
    description="4-stage ML pipeline: Classification → Segmentation → Extraction → Suggestion",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread lock for TensorFlow models (NOT thread-safe)
tf_lock = threading.Lock()

# ──────────────────────────────────────────────────────────
# Model Loading (runs once at startup)
# ──────────────────────────────────────────────────────────
logger.info("Loading all models — this takes 5-10 seconds…")

# Suppress TF noise
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf
tf.get_logger().setLevel("ERROR")
from tensorflow.keras.applications.efficientnet import preprocess_input

def load_h5_model(path, compile_model=True):
    """
    Load a Keras .h5 model with compatibility fix.
    Strips 'quantization_config' from layer configs that cause errors
    between Keras versions.
    """
    import h5py, tempfile, shutil
    
    # Try direct load first
    try:
        return tf.keras.models.load_model(path, compile=compile_model)
    except (TypeError, ValueError) as e:
        if "quantization_config" not in str(e):
            raise
        logger.info(f"Patching model config to remove quantization_config...")
    
    # Patch: open h5, strip quantization_config from model_config, save to temp, reload
    tmp_path = path + ".patched.h5"
    shutil.copy2(path, tmp_path)
    
    try:
        with h5py.File(tmp_path, "r+") as f:
            if "model_config" in f.attrs:
                config_str = f.attrs["model_config"]
                if isinstance(config_str, bytes):
                    config_str = config_str.decode("utf-8")
                # Remove all occurrences of "quantization_config": None/null
                import re
                config_str = re.sub(r',\s*"quantization_config":\s*null', '', config_str)
                config_str = re.sub(r'"quantization_config":\s*null,?\s*', '', config_str)
                f.attrs["model_config"] = config_str
        
        model = tf.keras.models.load_model(tmp_path, compile=compile_model)
        logger.info("Model loaded successfully with patched config ✓")
        return model
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

# Stage 1 — Classification
classifier = load_h5_model(os.path.join(MODELS_DIR, "brain_tumor_classifier.h5"))
with open(os.path.join(MODELS_DIR, "calibration.json")) as f:
    calib = json.load(f)
TEMPERATURE = calib["temperature"]  # 1.8874
CLASS_NAMES = calib["classes"]      # ['glioma','meningioma','notumor','pituitary']
IMG_SIZE_CLS = calib.get("img_size", 224)

# Stage 2 — Segmentation
segmentor = load_h5_model(
    os.path.join(MODELS_DIR, "tumor_unet_best_dice.h5"), compile_model=False
)
IMG_SIZE_SEG = 256

# Stage 4 — Suggestion (XGBoost)
suggestion_models = {
    "treatment_plan":  joblib.load(os.path.join(MODELS_DIR, "treatment_plan_xgb_model.pkl")),
    "urgency_level":   joblib.load(os.path.join(MODELS_DIR, "urgency_level_xgb_model.pkl")),
    "triage_tier":     joblib.load(os.path.join(MODELS_DIR, "triage_tier_xgb_model.pkl")),
}
scaler = joblib.load(os.path.join(MODELS_DIR, "scaler.pkl"))

with open(os.path.join(MODELS_DIR, "model_metadata.json")) as f:
    meta = json.load(f)

feature_encoders = {}
for col, classes in meta["feature_encoders"].items():
    le = LabelEncoder()
    le.classes_ = np.array(classes)
    feature_encoders[col] = le

target_encoders = {}
for col, classes in meta["target_encoders"].items():
    le = LabelEncoder()
    le.classes_ = np.array(classes)
    target_encoders[col] = le

logger.info("All models loaded successfully ✓")


# ──────────────────────────────────────────────────────────
# Stage 1: Classification
# ──────────────────────────────────────────────────────────
def classify_image(img_bgr: np.ndarray):
    """RGB 224×224 → EfficientNet → temperature calibration → tumor_type + confidence"""
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    img_resized = cv2.resize(img_rgb, (IMG_SIZE_CLS, IMG_SIZE_CLS))
    img_input = preprocess_input(img_resized.astype(np.float32))
    img_batch = np.expand_dims(img_input, axis=0)

    with tf_lock:
        probs = classifier.predict(img_batch, verbose=0)[0]

    # Temperature scaling calibration
    logits = np.log(probs + 1e-12)
    scaled_logits = logits / TEMPERATURE
    exp_logits = np.exp(scaled_logits - np.max(scaled_logits))
    calibrated_probs = exp_logits / exp_logits.sum()

    pred_idx = int(np.argmax(calibrated_probs))
    tumor_type = CLASS_NAMES[pred_idx]
    confidence = float(calibrated_probs[pred_idx])
    conf_level = "HIGH" if confidence >= 0.80 else "LOW"

    return tumor_type, confidence, conf_level


# ──────────────────────────────────────────────────────────
# Stage 2: Segmentation
# ──────────────────────────────────────────────────────────
def segment_image(img_bgr: np.ndarray):
    """Grayscale 256×256 → U-Net → binary mask"""
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    img_resized = cv2.resize(gray, (IMG_SIZE_SEG, IMG_SIZE_SEG))
    img_input = img_resized.astype(np.float32) / 255.0
    img_batch = img_input.reshape(1, IMG_SIZE_SEG, IMG_SIZE_SEG, 1)

    with tf_lock:
        pred_mask = segmentor.predict(img_batch, verbose=0)[0, :, :, 0]

    binary_mask = (pred_mask > 0.5).astype(np.uint8)
    return binary_mask, img_resized


# ──────────────────────────────────────────────────────────
# Stage 3a: Tumor Size Extraction
# ──────────────────────────────────────────────────────────
def calculate_tumor_size(binary_mask: np.ndarray):
    """Binary mask → area_mm2, major_diameter, minor_diameter (clamped)"""
    pixel_area = float(np.sum(binary_mask))
    PIXEL_TO_MM2 = 0.75  # approximate conversion factor
    area_mm2 = pixel_area * PIXEL_TO_MM2

    # Clamp to [15, 4000]
    area_mm2 = max(15.0, min(4000.0, area_mm2))

    contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    major_d = 0.0
    minor_d = 0.0
    if contours:
        largest = max(contours, key=cv2.contourArea)
        if len(largest) >= 5:
            ellipse = cv2.fitEllipse(largest)
            axes = ellipse[1]  # (width, height)
            major_d = float(max(axes)) * (PIXEL_TO_MM2 ** 0.5)
            minor_d = float(min(axes)) * (PIXEL_TO_MM2 ** 0.5)

    return area_mm2, major_d, minor_d


# ──────────────────────────────────────────────────────────
# Stage 3b: Tumor Location Extraction
# ──────────────────────────────────────────────────────────
def get_tumor_location(binary_mask: np.ndarray, tumor_type: str):
    """Binary mask + tumor_type → location, hemisphere, detail"""
    # Pituitary → force Sellar, Midline
    if tumor_type == "pituitary":
        return "Sellar", "M", "Sellar Region (Midline)"

    contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return "Frontal", "M", "Frontal Lobe (Midline)"

    largest = max(contours, key=cv2.contourArea)
    M_moments = cv2.moments(largest)
    if M_moments["m00"] == 0:
        return "Frontal", "M", "Frontal Lobe (Midline)"

    cx = M_moments["m10"] / M_moments["m00"]
    cy = M_moments["m01"] / M_moments["m00"]
    h, w = binary_mask.shape
    norm_x = cx / w
    norm_y = cy / h

    # Location by normalized Y
    if norm_y < 0.35:
        location = "Frontal"
    elif norm_y < 0.55:
        location = "Temporal" if (norm_x < 0.25 or norm_x > 0.75) else "Frontal"
    elif norm_y < 0.75:
        location = "Parietal"
    else:
        location = "Occipital"

    # Hemisphere by normalized X
    if norm_x < 0.42:
        hemisphere = "L"
        hemi_label = "Left"
    elif norm_x > 0.58:
        hemisphere = "R"
        hemi_label = "Right"
    else:
        hemisphere = "M"
        hemi_label = "Midline"

    detail = f"{hemi_label} {location} Lobe"
    return location, hemisphere, detail


# ──────────────────────────────────────────────────────────
# Stage 4: Treatment Suggestion
# ──────────────────────────────────────────────────────────
def predict_action(patient_data: dict):
    """17-feature dict → treatment_plan, urgency_level, triage_tier"""
    df = pd.DataFrame([patient_data])

    # Step 1 — Encode categorical features
    for col in meta["categorical_columns"]:
        if col in df.columns and col in feature_encoders:
            try:
                df[col] = feature_encoders[col].transform(df[col])
            except ValueError:
                raise HTTPException(400, f"Invalid value for {col}: {df[col].values[0]}")

    # Step 2 — Enforce column order
    df = df[meta["feature_columns"]]

    # Step 3 — Scale numeric features
    numeric_cols = meta["numeric_columns"]
    df_scaled = df.copy()
    df_scaled[numeric_cols] = scaler.transform(df[numeric_cols])

    row_scaled = df_scaled.values

    results = {}
    for target in ["treatment_plan", "urgency_level", "triage_tier"]:
        pred = suggestion_models[target].predict(row_scaled)[0]
        label = target_encoders[target].inverse_transform([int(pred)])[0]
        results[target] = label

    return results


# ──────────────────────────────────────────────────────────
# Overlay Generation
# ──────────────────────────────────────────────────────────
def generate_overlay(gray_img: np.ndarray, binary_mask: np.ndarray) -> str:
    """Generate a red-tinted overlay image, return as base64-encoded PNG."""
    colored = cv2.cvtColor(gray_img, cv2.COLOR_GRAY2BGR)
    overlay = colored.copy()
    overlay[binary_mask == 1] = [0, 0, 255]  # Red for tumor pixels
    blended = cv2.addWeighted(colored, 0.7, overlay, 0.3, 0)

    # Draw contour outline
    contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(blended, contours, -1, (0, 255, 0), 1)  # Green outline

    _, buf = cv2.imencode(".png", blended)
    return base64.b64encode(buf).decode("utf-8")


# ──────────────────────────────────────────────────────────
# Main API Endpoint
# ──────────────────────────────────────────────────────────
@app.post("/predict")
async def predict(
    image: UploadFile = File(...),
    age: int = Form(30),
    sex: str = Form("M"),
    smoking_status: str = Form("Never"),
    diabetes: int = Form(0),
    hypertension: int = Form(0),
    prior_cancer: int = Form(0),
    prior_brain_surgery: int = Form(0),
    immunosuppressed: int = Form(0),
    seizures: int = Form(0),
    headache_severity: int = Form(5),
    symptom_duration_weeks: int = Form(4),
    functional_status: str = Form("Independent"),
    neurological_symptoms: int = Form(0),
):
    """
    Full 4-stage pipeline endpoint.
    Accepts a multipart form with 1 image + 13 patient fields.
    Returns full JSON analysis result.
    """
    # --- Read image ---
    contents = await image.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(400, "Invalid image format. Must be .jpg, .png, or .bmp")

    logger.info("▶ Stage 1: Classification…")
    tumor_type, confidence, conf_level = classify_image(img_bgr)

    # --- Decision Point: no tumor ---
    if tumor_type == "notumor":
        return {
            "tumor_type": "notumor",
            "confidence": round(confidence, 4),
            "confidence_level": conf_level,
            "message": "No tumor detected. No further analysis needed.",
            "tumor_size_mm2": 0,
            "tumor_location": None,
            "hemisphere": None,
            "location_detail": "N/A",
            "major_diameter_mm": 0,
            "minor_diameter_mm": 0,
            "treatment_plan": "No treatment required",
            "urgency_level": "Elective",
            "triage_tier": "Routine",
            "overlay_image": None,
        }

    logger.info("▶ Stage 2: Segmentation…")
    binary_mask, gray_resized = segment_image(img_bgr)

    logger.info("▶ Stage 3: Size & Location extraction…")
    area_mm2, major_d, minor_d = calculate_tumor_size(binary_mask)
    location, hemisphere, detail = get_tumor_location(binary_mask, tumor_type)

    logger.info("▶ Stage 4: Treatment suggestion…")
    patient_data = {
        "age": age,
        "sex": sex,
        "smoking_status": smoking_status,
        "diabetes": diabetes,
        "hypertension": hypertension,
        "prior_cancer": prior_cancer,
        "prior_brain_surgery": prior_brain_surgery,
        "immunosuppressed": immunosuppressed,
        "seizures": seizures,
        "headache_severity": headache_severity,
        "symptom_duration_weeks": symptom_duration_weeks,
        "functional_status": functional_status,
        "neurological_symptoms": neurological_symptoms,
        "tumor_type": tumor_type,
        "tumor_location": location,
        "tumor_size_mm2": area_mm2,
        "hemisphere": hemisphere,
    }
    suggestions = predict_action(patient_data)

    logger.info("▶ Generating overlay image…")
    overlay_b64 = generate_overlay(gray_resized, binary_mask)

    result = {
        "tumor_type": tumor_type,
        "confidence": round(confidence, 4),
        "confidence_level": conf_level,
        "tumor_size_mm2": round(area_mm2, 1),
        "tumor_location": location,
        "hemisphere": hemisphere,
        "location_detail": detail,
        "major_diameter_mm": round(major_d, 1),
        "minor_diameter_mm": round(minor_d, 1),
        "treatment_plan": suggestions["treatment_plan"],
        "urgency_level": suggestions["urgency_level"],
        "triage_tier": suggestions["triage_tier"],
        "overlay_image": overlay_b64,
    }

    logger.info(f"✓ Pipeline complete: {tumor_type} ({confidence:.1%}) → {suggestions['triage_tier']}")
    return result


# ──────────────────────────────────────────────────────────
# Health Check
# ──────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models_loaded": True,
        "stages": ["classification", "segmentation", "extraction", "suggestion"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
