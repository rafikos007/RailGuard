from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import os
import uuid
import datetime
from fastapi.staticfiles import StaticFiles

try:
    from ultralytics import YOLO
    from PIL import Image
    import numpy as np
    import cv2
except ImportError:
    YOLO = None
    Image = None
    np = None
    cv2 = None

import models, schemas, auth, database

app = FastAPI(title="Railway Defect Dashboard API")

# Ensure database tables exist
models.Base.metadata.create_all(bind=database.engine)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

IMAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "images"))
os.makedirs(IMAGES_DIR, exist_ok=True)
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

SOURCE_IMAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "images"))
if os.path.exists(SOURCE_IMAGES_DIR):
    app.mount("/source-images", StaticFiles(directory=SOURCE_IMAGES_DIR), name="source-images")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    from jose import JWTError, jwt
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Impossible de valider les identifiants",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def get_admin_user(current_user: models.User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Opération non autorisée")
    return current_user

def serialize_fixed_defect(fixed_defect: models.FixedDefect, username_map: dict):
    return {
        "id": fixed_defect.id,
        "original_defect_id": fixed_defect.original_defect_id,
        "original_image_path": fixed_defect.original_image_path,
        "repaired_image_path": fixed_defect.repaired_image_path,
        "defect_class": fixed_defect.defect_class,
        "confidence": fixed_defect.confidence,
        "lat": fixed_defect.lat,
        "lon": fixed_defect.lon,
        "date_detected": fixed_defect.date_detected,
        "assigned_to": fixed_defect.assigned_to,
        "report_text": fixed_defect.report_text,
        "repaired_by": fixed_defect.repaired_by,
        "repaired_by_username": username_map.get(fixed_defect.repaired_by),
        "repaired_at": fixed_defect.repaired_at,
        "is_seen_by_admin": bool(fixed_defect.is_seen_by_admin),
    }

@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nom d'utilisateur ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.get("/api/defects", response_model=List[schemas.DefectResponse])
def get_defects(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Defect)
    if current_user.role != 'admin':
        query = query.filter(models.Defect.assigned_to == current_user.id)
    return query.order_by(models.Defect.date_detected.desc()).all()

@app.get("/api/stats/defects")
def get_defect_stats(month: Optional[int] = None, year: Optional[int] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.Defect.defect_class, func.count(models.Defect.id))
    if current_user.role != 'admin':
        query = query.filter(models.Defect.assigned_to == current_user.id)
    if month:
        query = query.filter(func.extract('month', models.Defect.date_detected) == month)
    if year:
        query = query.filter(func.extract('year', models.Defect.date_detected) == year)
    
    results = query.group_by(models.Defect.defect_class).all()
    return [{"name": r[0], "value": r[1]} for r in results]

@app.get("/api/stats/fixed")
def get_fixed_stats(month: Optional[int] = None, year: Optional[int] = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    query = db.query(models.FixedDefect.defect_class, func.count(models.FixedDefect.id))
    if current_user.role != 'admin':
        query = query.filter(models.FixedDefect.repaired_by == current_user.id)
    if month:
        query = query.filter(func.extract('month', models.FixedDefect.repaired_at) == month)
    if year:
        query = query.filter(func.extract('year', models.FixedDefect.repaired_at) == year)
    
    results = query.group_by(models.FixedDefect.defect_class).all()
    return [{"name": r[0], "value": r[1]} for r in results]

@app.get("/api/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(database.get_db), admin_user: models.User = Depends(get_admin_user)):
    return db.query(models.User).all()

@app.post("/api/users", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db), admin_user: models.User = Depends(get_admin_user)):
    hashed_pw = auth.get_password_hash(user.password)
    db_user = models.User(username=user.username, hashed_password=hashed_pw, region=user.region)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.put("/api/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(database.get_db), admin_user: models.User = Depends(get_admin_user)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if user_update.username: db_user.username = user_update.username
    if user_update.password: db_user.hashed_password = auth.get_password_hash(user_update.password)
    if user_update.region: db_user.region = user_update.region
    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(database.get_db), admin_user: models.User = Depends(get_admin_user)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    db.delete(db_user)
    db.commit()
    return {"message": "Utilisateur supprimé"}

@app.post("/api/admin/distribute-defects")
def distribute_defects(db: Session = Depends(database.get_db), admin_user: models.User = Depends(get_admin_user)):
    # 1. Récupérer et grouper les employés par région
    employees = db.query(models.User).filter(models.User.role == 'employee').all()
    if not employees:
        raise HTTPException(status_code=400, detail="Aucun employé trouvé pour la distribution")
    
    emp_alger = [e for e in employees if e.region == 'Alger']
    emp_bouira = [e for e in employees if e.region == 'Bouira']
    
    # 2. Récupérer les défauts non assignés (ou tous pour redistribution)
    defects = db.query(models.Defect).all()
    if not defects:
        return {"detail": "Aucun défaut à distribuer"}
    
    counts = {"Alger": 0, "Bouira": 0}
    
    for defect in defects:
        # Détermination de la région du défaut par sa latitude
        # Alger ~36.7, Bouira ~36.3
        defect_region = "Alger" if defect.lat > 36.5 else "Bouira"
        
        target_employees = emp_alger if defect_region == "Alger" else emp_bouira
        
        if target_employees:
            # Distribution équitable (Round-robin simple basé sur le compte actuel)
            assigned_employee = target_employees[counts[defect_region] % len(target_employees)]
            defect.assigned_to = assigned_employee.id
            counts[defect_region] += 1
            
    db.commit()
    return {
        "detail": f"Distribution terminée : {counts['Alger']} défauts à Alger, {counts['Bouira']} défauts à Bouira."
    }

@app.post("/api/repair", response_model=schemas.FixedDefectResponse)
async def repair_defect(
    defect_id: int = Form(...),
    report_text: str = Form(""),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    orig = db.query(models.Defect).filter(models.Defect.id == defect_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Défaut non trouvé")
    
    content = await file.read()
    filename = f"repair_{uuid.uuid4()}.jpg"
    with open(os.path.join(IMAGES_DIR, filename), "wb") as f:
        f.write(content)
        
    fixed = models.FixedDefect(
        original_defect_id=orig.id,
        original_image_path=orig.image_path,
        repaired_image_path=filename,
        defect_class=orig.defect_class,
        confidence=orig.confidence,
        lat=orig.lat, lon=orig.lon,
        date_detected=orig.date_detected,
        assigned_to=orig.assigned_to,
        report_text=report_text,
        repaired_by=current_user.id,
        repaired_at=datetime.datetime.utcnow(),
        is_seen_by_admin=False
    )
    db.add(fixed)
    db.delete(orig)
    db.commit()
    db.refresh(fixed)
    return serialize_fixed_defect(fixed, {current_user.id: current_user.username})

@app.get("/api/fixed-defects", response_model=List[schemas.FixedDefectResponse])
def get_fixed_defects(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    results = db.query(models.FixedDefect).order_by(models.FixedDefect.repaired_at.desc()).all()
    users = db.query(models.User).all()
    uname_map = {u.id: u.username for u in users}
    return [serialize_fixed_defect(f, uname_map) for f in results]

@app.get("/api/fixed-defects/unseen-count")
def get_unseen_count(db: Session = Depends(database.get_db), admin_user: models.User = Depends(get_admin_user)):
    count = db.query(models.FixedDefect).filter(models.FixedDefect.is_seen_by_admin == False).count()
    return {"count": count}

@app.post("/api/fixed-defects/mark-seen")
def mark_all_seen(db: Session = Depends(database.get_db), admin_user: models.User = Depends(get_admin_user)):
    db.query(models.FixedDefect).update({models.FixedDefect.is_seen_by_admin: True})
    db.commit()
    return {"message": "Success"}

@app.post("/api/detect", response_model=schemas.DefectResponse)
async def run_detection(is_test: bool = Form(False), file: UploadFile = File(...), current_user: models.User = Depends(get_current_user), db: Session = Depends(database.get_db)):
    if YOLO is None or Image is None or cv2 is None:
        raise HTTPException(status_code=500, detail="Bibliothèques de détection non installées")
        
    content = await file.read()
    temp_id = str(uuid.uuid4())
    temp_path = os.path.join(IMAGES_DIR, f"temp_{temp_id}.jpg")
    
    with open(temp_path, "wb") as f:
        f.write(content)
        
    base_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.abspath(os.path.join(base_dir, "..", "Models"))
    
    seg_model_path = os.path.join(models_dir, "rails_segmentation_yolov11", "weights", "best.pt")
    defect_model_path = os.path.join(models_dir, "rails_defect_yolov11", "weights", "best.pt")

    if not os.path.exists(seg_model_path) or not os.path.exists(defect_model_path):
        os.remove(temp_path)
        raise HTTPException(status_code=400, detail="Modèles introuvables")
        
    seg_model = YOLO(seg_model_path)
    defect_model = YOLO(defect_model_path)
    
    img = cv2.imread(temp_path)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Stage 1: Segmentation
    seg_results = seg_model.predict(temp_path, save=False, device='cpu', conf=0.05, verbose=False)
    
    size = 640
    canvas_color = 114
    
    if len(seg_results[0].boxes) > 0:
        boxes = seg_results[0].boxes.xyxy.cpu().numpy()
        x_min, y_min = int(np.min(boxes[:, 0])), int(np.min(boxes[:, 1]))
        x_max, y_max = int(np.max(boxes[:, 2])), int(np.max(boxes[:, 3]))
        rail_crop = img_rgb[y_min:y_max, x_min:x_max]
        h_c, w_c = rail_crop.shape[:2]
        scale = min(size/h_c, size/w_c)
        resized = cv2.resize(rail_crop, (int(w_c*scale), int(h_c*scale)))
        canvas = np.full((size, size, 3), canvas_color, dtype=np.uint8)
        y_o, x_o = (size - resized.shape[0]) // 2, (size - resized.shape[1]) // 2
        canvas[y_o:y_o+resized.shape[0], x_o:x_o+resized.shape[1]] = resized
        final_input = canvas
    else:
        final_input = cv2.resize(img_rgb, (size, size))

    norm_path = os.path.join(IMAGES_DIR, f"norm_{temp_id}.jpg")
    Image.fromarray(final_input).save(norm_path)

    # Stage 2: Detection
    results = defect_model.predict(norm_path, save=False, device='cpu', verbose=False)
    
    if not results[0].boxes:
        if os.path.exists(temp_path): os.remove(temp_path)
        if os.path.exists(norm_path): os.remove(norm_path)
        raise HTTPException(status_code=400, detail="Aucun défaut détecté")
        
    defect_type = results[0].names[int(results[0].boxes.cls[0])]
    confidence = float(results[0].boxes.conf[0].item())
    
    plot_image = results[0].plot()
    final_filename = f"detect_{temp_id}.png"
    Image.fromarray(plot_image).save(os.path.join(IMAGES_DIR, final_filename))
    
    if not is_test:
        new_defect = models.Defect(
            defect_class=defect_type,
            confidence=confidence,
            image_path=final_filename,
            lat=36.7, lon=3.0,
            date_detected=datetime.datetime.utcnow()
        )
        db.add(new_defect)
        db.commit()
        db.refresh(new_defect)
        
    if os.path.exists(temp_path): os.remove(temp_path)
    if os.path.exists(norm_path): os.remove(norm_path)

    return {
        "id": 0 if is_test else new_defect.id,
        "defect_class": defect_type,
        "confidence": confidence,
        "image_path": final_filename,
        "lat": 36.7 if not is_test else 0.0, 
        "lon": 3.0 if not is_test else 0.0,
        "date_detected": datetime.datetime.utcnow()
    }
