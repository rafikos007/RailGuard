import sys
import os
from ultralytics import YOLO
from PyQt5.QtWidgets import (
    QApplication, QWidget, QLabel, QPushButton, QVBoxLayout, QFileDialog,
    QHBoxLayout, QMessageBox, QGroupBox
)
from PyQt5.QtGui import QPixmap, QFont
from PyQt5.QtCore import Qt, QSize
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
import numpy as np
import cv2
import csv
from PIL import Image

# Load database configuration from backend folder (Local SQLite Mode)
load_dotenv(os.path.join("..", "backend", ".env"))
DATABASE_URL = "sqlite:///../backend/railways.db"

# Dictionnaire de traduction pour les classes YOLO
CLASS_NAMES_FR = {
    "crack": "Fissure",
    "squat": "Squat",
    "spalling": "Écaillage",
    "joint": "Joint",
    "joints": "Joint"
}

Base = declarative_base()

class Defect(Base):
    __tablename__ = 'defects'
    id = Column(Integer, primary_key=True, autoincrement=True)
    image_path = Column(String)
    defect_class = Column(String)
    confidence = Column(Float)
    lat = Column(Float)
    lon = Column(Float)
    date_detected = Column(DateTime)


class ImageLabel(QLabel):
    """Custom QLabel that maintains aspect ratio of scaled pixmap."""
    def __init__(self, text=""):
        super().__init__(text)
        self.setAlignment(Qt.AlignCenter)
        self.setMinimumSize(400, 300)
        self._pixmap = None

    def setPixmap(self, pixmap):
        self._pixmap = pixmap
        self.update_pixmap()

    def update_pixmap(self):
        if self._pixmap and not self._pixmap.isNull():
            scaled_pixmap = self._pixmap.scaled(
                self.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation
            )
            super().setPixmap(scaled_pixmap)
        else:
            super().clear()

    def resizeEvent(self, event):
        self.update_pixmap()
        super().resizeEvent(event)


class DetectionInterfaceApp(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Intelligence des Défauts Ferroviaires - Modèle Personnalisé")
        self.setMinimumSize(1100, 800)
        
        self.batch_data = []  # List of dicts mapping each image's states
        self.current_index = 0
        self.rails_extracted = False
        self.defects_detected = False

        self.setStyleSheet("""
            QWidget {
                background-color: #0f172a;
                color: #f8fafc;
                font-family: 'Segoe UI', system-ui, sans-serif;
            }
            QGroupBox {
                border: 1px solid #334155;
                border-radius: 12px;
                margin-top: 18px;
                padding: 16px;
                background-color: #1e293b;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                subcontrol-position: top left;
                padding: 0 10px;
                color: #38bdf8;
                font-size: 14px;
                font-weight: bold;
            }
            QLabel {
                color: #cbd5e1;
            }
            QLabel[isImageLabel="true"] {
                background-color: #0b1121;
                border: 2px dashed #475569;
                border-radius: 12px;
                color: #475569;
                font-weight: bold;
                font-size: 16px;
            }
            QLabel#AppTitle {
                font-size: 28px;
                font-weight: 800;
                color: #f8fafc;
                padding: 5px;
            }
            QPushButton {
                background-color: #3b82f6;
                color: white;
                border: none;
                border-radius: 8px;
                padding: 10px 18px;
                font-size: 14px;
                font-weight: bold;
            }
            QPushButton:hover { background-color: #2563eb; }
            QPushButton#DetectBtn { background-color: #10b981; }
            QPushButton#DetectBtn:hover { background-color: #059669; }
            QPushButton#SecondaryBtn { background-color: #ef4444; }
            QPushButton#SecondaryBtn:hover { background-color: #dc2626; }
            QPushButton#NavBtn { background-color: #334155; }
            QPushButton#NavBtn:hover { background-color: #475569; }
            QMessageBox { background-color: #1e293b; }
            QMessageBox QLabel { color: white; }
            QMessageBox QPushButton { min-width: 80px; }
        """)

        # Load models
        seg_model_path = r"C:\Users\IT7\OneDrive\Desktop\documents_pfe\Projet_rails\Models\rails_segmentation_yolov11\weights\best.pt"
        defect_model_path = r"C:\Users\IT7\OneDrive\Desktop\documents_pfe\Projet_rails\Models\rails_defect_yolov11\weights\best.pt"
        base_dir = os.path.dirname(os.path.abspath(__file__))

        if os.path.exists(seg_model_path):
            self.seg_model = YOLO(seg_model_path)
            print("Modèle de segmentation chargé.")
        else:
            print(f"Attention : Modèle de segmentation introuvable à {seg_model_path}")
            self.seg_model = None

        if os.path.exists(defect_model_path):
            self.defect_model = YOLO(defect_model_path)
            print("Modèle de détection de défauts chargé.")
        else:
            print(f"Attention : Modèle de détection de défauts introuvable à {defect_model_path}")
            self.defect_model = None

        self.init_db()

        # UI Elements
        self.title_label = QLabel("Détection des Défauts Ferroviaires")
        self.title_label.setObjectName("AppTitle")
        self.title_label.setAlignment(Qt.AlignCenter)

        self.img_label_before = ImageLabel("Image Originale (Avant)")
        self.img_label_before.setProperty("isImageLabel", True)
        
        self.img_label_after = ImageLabel("Résultat de la Détection (Après)")
        self.img_label_after.setProperty("isImageLabel", True)

        self.btn_select = QPushButton("Image Unique")
        self.btn_load_folder = QPushButton("Dossier d'Images")
        self.btn_load_folder.setStyleSheet("background-color: #f59e0b;") # Amber
        
        self.btn_extract = QPushButton("Extraire les Rails")
        self.btn_extract.setStyleSheet("background-color: #6366f1;") # Indigo
        
        self.btn_detect = QPushButton("Détecter les Défauts")
        self.btn_detect.setObjectName("DetectBtn") # Emerald
        
        self.btn_save_db = QPushButton("Ajouter au Dataset")
        self.btn_save_db.setStyleSheet("background-color: #8b5cf6;") # Purple
        
        self.btn_reset = QPushButton("Réinitialiser")
        self.btn_reset.setObjectName("SecondaryBtn") # Red
        
        self.btn_prev = QPushButton("< Précédent")
        self.btn_prev.setObjectName("NavBtn")
        self.btn_next = QPushButton("Suivant >")
        self.btn_next.setObjectName("NavBtn")
        self.lbl_counter = QLabel("Image 0/0")
        self.lbl_counter.setAlignment(Qt.AlignCenter)

        self.status_label = QLabel("Prêt")
        self.status_label.setStyleSheet("font-size: 14px; font-weight: bold; color: #94a3b8;")

        self.init_ui()

        self.btn_select.clicked.connect(self.select_image)
        self.btn_load_folder.clicked.connect(self.load_image_folder)
        self.btn_reset.clicked.connect(self.reset_images)
        self.btn_extract.clicked.connect(self.run_extraction)
        self.btn_detect.clicked.connect(self.run_defect_detection)
        self.btn_save_db.clicked.connect(self.save_batch_to_db)
        
        self.btn_prev.clicked.connect(self.show_prev_image)
        self.btn_next.clicked.connect(self.show_next_image)

    def init_db(self):
        try:
            if not DATABASE_URL:
                print("Warning: DATABASE_URL not found in environment. Database features will be disabled.")
                self.engine = None
                return

            self.engine = create_engine(DATABASE_URL)
            # Create tables if they don't exist
            Base.metadata.create_all(self.engine)
            self.Session = sessionmaker(bind=self.engine)
            print("Connexion à la base de données cloud Supabase réussie.")
        except Exception as e:
            print(f"Warning: Failed to initialize Database: {e}")
            self.engine = None

    def init_ui(self):
        main_layout = QVBoxLayout()
        main_layout.setContentsMargins(30, 20, 30, 20)
        main_layout.setSpacing(15)

        main_layout.addWidget(self.title_label)

        # Content horizontal split
        content_layout = QHBoxLayout()
        
        # Left group
        before_group = QGroupBox("Image d'Entrée")
        before_layout = QVBoxLayout()
        before_layout.addWidget(self.img_label_before)
        before_group.setLayout(before_layout)
        
        # Right group
        after_group = QGroupBox("Résultat de l'Analyse")
        after_layout = QVBoxLayout()
        after_layout.addWidget(self.img_label_after)
        after_group.setLayout(after_layout)

        content_layout.addWidget(before_group)
        content_layout.addWidget(after_group)
        main_layout.addLayout(content_layout, 1)

        # Navigation Layout
        nav_layout = QHBoxLayout()
        nav_layout.addWidget(self.btn_prev)
        nav_layout.addStretch()
        nav_layout.addWidget(self.lbl_counter)
        nav_layout.addStretch()
        nav_layout.addWidget(self.btn_next)
        main_layout.addLayout(nav_layout)

        # Operations
        action_group = QGroupBox("Opérations")
        action_layout = QHBoxLayout()
        action_layout.setSpacing(10)
        action_layout.addWidget(self.btn_select)
        action_layout.addWidget(self.btn_load_folder)
        action_layout.addWidget(self.btn_extract)
        action_layout.addWidget(self.btn_detect)
        action_layout.addWidget(self.btn_save_db)
        action_layout.addWidget(self.btn_reset)
        action_group.setLayout(action_layout)
        
        main_layout.addWidget(action_group)

        # Status Bar
        status_layout = QHBoxLayout()
        status_layout.addWidget(QLabel("État : "))
        status_layout.addWidget(self.status_label)
        status_layout.addStretch()
        main_layout.addLayout(status_layout)

        self.setLayout(main_layout)

    def update_view(self):
        """Updates the screen to display the currently selected image from the batch."""
        if not self.batch_data:
            self.lbl_counter.setText("Image 0/0")
            self.img_label_before._pixmap = None
            self.img_label_before.clear()
            self.img_label_before.setText("Image Originale (Avant)")
            self.img_label_after._pixmap = None
            self.img_label_after.clear()
            self.img_label_after.setText("Résultat de la Détection (Après)")
            return

        total = len(self.batch_data)
        self.lbl_counter.setText(f"Image {self.current_index + 1} / {total}")
        current_data = self.batch_data[self.current_index]

        if current_data['orig_path'] and os.path.exists(current_data['orig_path']):
            self.img_label_before.setPixmap(QPixmap(current_data['orig_path']))
        
        if current_data['result_path'] and os.path.exists(current_data['result_path']):
            self.img_label_after.setPixmap(QPixmap(current_data['result_path']))
        elif current_data['processed_path'] and os.path.exists(current_data['processed_path']):
            self.img_label_after.setPixmap(QPixmap(current_data['processed_path']))
        else:
            self.img_label_after._pixmap = None
            self.img_label_after.clear()
            self.img_label_after.setText("En attente de l'extraction/détection...")

    def show_prev_image(self):
        if self.batch_data and self.current_index > 0:
            self.current_index -= 1
            self.update_view()

    def show_next_image(self):
        if self.batch_data and self.current_index < len(self.batch_data) - 1:
            self.current_index += 1
            self.update_view()

    def select_image(self):
        file, _ = QFileDialog.getOpenFileName(self, "Sélectionner une Image de Rail", "", "Images (*.png *.jpg *.jpeg)")
        if file:
            self.batch_data = [{
                'filename': os.path.basename(file),
                'orig_path': file,
                'processed_path': None,
                'result_path': None,
                'lat': 0.0,
                'lon': 0.0,
                'date_str': __import__("datetime").datetime.utcnow().isoformat(),
                'defects': []
            }]
            self.current_index = 0
            self.rails_extracted = False
            self.defects_detected = False
            self.update_view()
            self.status_label.setText("1 image chargée en mode unique.")
            self.status_label.setStyleSheet("color: #38bdf8; font-weight: bold;")

    def load_image_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Sélectionner un Dossier d'Images")
        if folder:
            loaded_data = []
            for filename in os.listdir(folder):
                if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                    img_path = os.path.join(folder, filename)
                    loaded_data.append({
                        'filename': filename,
                        'orig_path': img_path,
                        'processed_path': None,
                        'result_path': None,
                        'defects': []
                    })
            
            if loaded_data:
                self.batch_data = loaded_data
                self.current_index = 0
                self.rails_extracted = False
                self.defects_detected = False
                self.update_view()
                self.status_label.setText(f"Lot chargé : {len(self.batch_data)} images du dossier.")
                self.status_label.setStyleSheet("color: #f59e0b; font-weight: bold;")
            else:
                QMessageBox.warning(self, "Vide", "Aucune image valide trouvée dans le dossier sélectionné.")

    def reset_images(self):
        self.batch_data = []
        self.current_index = 0
        self.rails_extracted = False
        self.defects_detected = False
        self.update_view()
        self.status_label.setText("Images et données effacées.")
        self.status_label.setStyleSheet("color: #94a3b8; font-weight: bold;")

    def run_extraction(self):
        if not self.batch_data:
            QMessageBox.warning(self, "Erreur", "Veuillez d'abord charger une image ou un lot CSV.")
            return

        if self.rails_extracted:
            QMessageBox.information(self, "Déjà effectué", "Vous avez déjà effectué l'extraction des rails pour ce lot.")
            return

        if self.seg_model is None:
            QMessageBox.warning(self, "Modèle Manquant", "Le modèle de segmentation n'est pas disponible.")
            return

        total = len(self.batch_data)
        for i, item in enumerate(self.batch_data):
            if not item['orig_path'] or not os.path.exists(item['orig_path']):
                continue
                
            self.status_label.setText(f"Étape 1 : Extraction des rails ({i+1}/{total})...")
            QApplication.processEvents()

            img = cv2.imread(item['orig_path'])
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            
            # Using Detection settings since model is trained on bounding boxes
            seg_results = self.seg_model.predict(
                item['orig_path'], save=False, device='cpu', 
                conf=0.05, imgsz=640, augment=True, agnostic_nms=True, verbose=False
            )
            
            size = 640
            canvas_color = 114
            
            if len(seg_results[0].boxes) > 0:
                boxes = seg_results[0].boxes.xyxy.cpu().numpy()
                x_min, y_min = int(np.min(boxes[:, 0])), int(np.min(boxes[:, 1]))
                x_max, y_max = int(np.max(boxes[:, 2])), int(np.max(boxes[:, 3]))

                rail_crop = img_rgb[y_min:y_max, x_min:x_max]
                h_crop, w_crop = rail_crop.shape[:2]
                
                scale = min(size / h_crop, size / w_crop)
                new_h, new_w = int(h_crop * scale), int(w_crop * scale)
                resized = cv2.resize(rail_crop, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
                
                canvas = np.full((size, size, 3), canvas_color, dtype=np.uint8)
                y_offset, x_offset = (size - new_h) // 2, (size - new_w) // 2
                canvas[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = resized
                
                temp_dir = os.path.join("static", "temp")
                os.makedirs(temp_dir, exist_ok=True)
                item['processed_path'] = os.path.join(temp_dir, f"isolated_{item['filename']}")
                Image.fromarray(canvas).save(item['processed_path'])
            else:
                item['processed_path'] = None # Failed extraction

        self.rails_extracted = True
        self.update_view()
        self.status_label.setText("Extraction du lot terminée. Prêt pour la détection.")

    def run_defect_detection(self):
        if not self.batch_data:
            QMessageBox.warning(self, "Erreur", "Veuillez d'abord charger une image ou un lot CSV.")
            return

        if not self.rails_extracted:
            QMessageBox.warning(self, "Action Requise", "Vous devez lancer la segmentation de rail d'abord.")
            return

        if self.defects_detected:
            QMessageBox.information(self, "Déjà effectué", "Vous avez déjà effectué la détection des défauts pour ce lot.")
            return

        if self.defect_model is None:
            QMessageBox.warning(self, "Modèle Manquant", "Le modèle de détection de défauts n'est pas disponible.")
            return

        total = len(self.batch_data)
        for i, item in enumerate(self.batch_data):
            if not item['processed_path'] or not os.path.exists(item['processed_path']):
                continue

            self.status_label.setText(f"Étape 2 : Détection des défauts ({i+1}/{total})...")
            QApplication.processEvents()

            results = self.defect_model.predict(item['processed_path'], save=False, device='cpu', verbose=False)
            
            # TRADUCTION DES CLASSES SUR LE RÉSULTAT (Évite le crash)
            # On modifie les noms uniquement dans l'objet 'results' pour l'affichage
            results[0].names = {i: CLASS_NAMES_FR.get(name, name) for i, name in results[0].names.items()}
            
            # Save results plot (boxes only, no confidence/labels)
            plot_image = results[0].plot(conf=False, labels=True)
            
            detect_dir = os.path.join("static", "results")
            os.makedirs(detect_dir, exist_ok=True)
            detect_filename = f"final_{item['filename']}"
            item['result_path'] = os.path.join(detect_dir, detect_filename)
            Image.fromarray(plot_image).save(item['result_path'], format="PNG")
            
            # Store defect data
            item['defects'] = []
            if results[0].boxes:
                for box in results[0].boxes:
                    # On récupère le nom original depuis le modèle pour la base de données
                    defect_type = self.defect_model.names[int(box.cls[0])]
                    confidence = float(box.conf[0].item())
                    item['defects'].append({'class': defect_type, 'conf': confidence})

        self.defects_detected = True
        self.update_view()
        self.status_label.setText("Analyse du lot terminée.")
        self.status_label.setStyleSheet("color: #10b981; font-weight: bold;")


    def save_batch_to_db(self):
        if not self.batch_data:
            QMessageBox.warning(self, "Erreur", "Rien à sauvegarder. Lancez d'abord la détection.")
            return

        # Check if there are any defects before prompting for CSV
        has_defects = any(item.get('defects') and item.get('result_path') for item in self.batch_data)
        if not has_defects:
            QMessageBox.information(self, "Aucun Défaut", "Aucun défaut n'a été trouvé dans ce lot. Rien à ajouter au jeu de données.")
            self.status_label.setText("Aucun défaut à sauvegarder.")
            return

        # Try to automatically find the official positions.csv file
        csv_file = os.path.abspath(os.path.join("..", "positions.csv"))
        if not os.path.exists(csv_file):
            csv_file = os.path.abspath(os.path.join("..", "position.csv"))
            if not os.path.exists(csv_file):
                # Prompt if we totally can't find it in the main directory
                QMessageBox.information(self, "Données GPS Requises", "Veuillez sélectionner le fichier 'positions.csv' pour attacher les coordonnées GPS aux défauts détectés.")
                csv_file, _ = QFileDialog.getOpenFileName(self, "Sélectionner positions.csv", "", "Fichiers CSV (*.csv)")
                
                if not csv_file:
                    self.status_label.setText("Sauvegarde annulée (aucun CSV sélectionné).")
                    return

        # Parse CSV into a lookup dictionary
        csv_data = {}
        try:
            with open(csv_file, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    filename = row.get('image', '').strip()
                    if filename:
                        try:
                            # Try to parse the date from CSV, fallback to now if it fails
                            date_raw = row.get('date', '').strip()
                            if date_raw:
                                csv_date = datetime.datetime.strptime(date_raw, "%Y-%m-%d %H:%M:%S")
                            else:
                                csv_date = datetime.datetime.utcnow()
                        except ValueError:
                            csv_date = datetime.datetime.utcnow()

                        csv_data[filename] = {
                            'lat': float(row.get('lat', 0.0)),
                            'lon': float(row.get('lon', 0.0)),
                            'date': csv_date
                        }
        except Exception as e:
            QMessageBox.critical(self, "Erreur CSV", f"Impossible de lire le fichier CSV : {e}")
            return
            
        defects_found = 0
        missing_gps = 0
        try:
            if not self.engine:
                QMessageBox.critical(self, "Erreur", "La base de données n'est pas connectée.")
                return

            session = self.Session()
            for item in self.batch_data:
                # IGNORING HEALTHY IMAGES: Focus only on the defects
                if not item.get('defects') or not item.get('result_path'):
                    continue
                    
                filename = item['filename']
                # Robust GPS lookup (ignore extension and case)
                filename_no_ext = os.path.splitext(filename)[0].lower()
                geo_info = None
                for csv_key in csv_data:
                    if os.path.splitext(csv_key)[0].lower() == filename_no_ext:
                        geo_info = csv_data[csv_key]
                        break

                if geo_info is None:
                    missing_gps += 1
                    geo_info = {
                        'lat': 0.0,
                        'lon': 0.0,
                        'date': datetime.datetime.utcnow()
                    }

                # 1. Save the RESULT image (with detection boxes)
                img_result = Image.open(item['result_path'])
                save_dir = os.path.abspath(os.path.join("..", "backend", "images"))
                os.makedirs(save_dir, exist_ok=True)
                target_result = f"result_{filename}"
                img_result.save(os.path.join(save_dir, target_result), format="PNG")

                # 2. Save the ORIGINAL image (simple/clean)
                img_orig = Image.open(item['orig_path'])
                target_orig = filename
                img_orig.save(os.path.join(save_dir, target_orig))

                # Save ONLY the best defect PER CLASS per image
                if item['defects']:
                    # Group by class and pick best for each class
                    best_by_class = {}
                    for d in item['defects']:
                        cls = d['class']
                        if cls not in best_by_class or d['conf'] > best_by_class[cls]['conf']:
                            best_by_class[cls] = d
                    
                    for defect in best_by_class.values():
                        new_defect = Defect(
                            image_path=target_orig,
                            defect_class=defect['class'],
                            confidence=defect['conf'],
                            lat=geo_info['lat'],
                            lon=geo_info['lon'],
                            date_detected=geo_info['date']
                        )
                        session.add(new_defect)
                        defects_found += 1
            
            session.commit()
            session.close()

            msg = f"Succès ! {defects_found} défauts ajoutés au jeu de données. Les rails sains ont été ignorés."
            if missing_gps > 0:
                msg += f"\n\nNote : {missing_gps} images défectueuses n'étaient pas dans positions.csv. Elles ont quand même été enregistrées avec des coordonnées GPS par défaut (0.0, 0.0)."
                
            QMessageBox.information(self, "Sauvegardé", msg)
            self.status_label.setText(f"{defects_found} défauts sauvegardés dans la base de données.")
            self.status_label.setStyleSheet("color: #8b5cf6; font-weight: bold;")
                
        except Exception as e:
            QMessageBox.critical(self, "Erreur de Base de Données", f"Impossible de sauvegarder le lot dans la base de données : {e}")
            self.status_label.setText("Échec de la sauvegarde du lot.")
            self.status_label.setStyleSheet("color: #ef4444; font-weight: bold;")

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = DetectionInterfaceApp()
    window.show()
    sys.exit(app.exec_())
