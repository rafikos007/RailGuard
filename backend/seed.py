import os
from datetime import datetime
from database import SessionLocal, engine
import models
from auth import get_password_hash

# Create tables
models.Base.metadata.create_all(bind=engine)

def seed_database():
    db = SessionLocal()
    
    # Update admin user if exists, otherwise create
    admin = db.query(models.User).filter(models.User.username == "admin").first()
    hashed_pw = get_password_hash("rafik2003$")
    if admin:
        admin.hashed_password = hashed_pw
        admin.role = "admin"
        print("Admin user password and role updated to: rafik2003$ / admin")
    else:
        new_admin = models.User(username="admin", hashed_password=hashed_pw, role="admin")
        db.add(new_admin)
        print("Admin user created (username: admin, password: rafik2003$, role: admin)")

    # Read CSV
    csv_path = "../detections_with_gps.csv"
    if os.path.exists(csv_path):
        import csv
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            csv_images = []
            count = 0
            for row in reader:
                img_path = str(row['image'])
                csv_images.append(img_path)
                existing = db.query(models.Defect).filter(models.Defect.image_path == img_path).first()
                if not existing:
                    try:
                        date_obj = datetime.strptime(str(row['date']), "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        date_obj = datetime.now()

                    new_defect = models.Defect(
                        image_path=img_path,
                        defect_class=str(row['defect']),
                        confidence=float(row['confidence']),
                        lat=float(row['lat']),
                        lon=float(row['lon']),
                        date_detected=date_obj
                    )
                    db.add(new_defect)
                    count += 1
            
            # Sync deletions using bulk operation
            deleted_count = db.query(models.Defect).filter(~models.Defect.image_path.in_(csv_images)).delete(synchronize_session=False)
            db.commit()
            
            if count > 0 or deleted_count > 0:
                print(f"Imported {count} new defects. Removed {deleted_count} deleted defects.")
            else:
                print("Database is fully synced with CSV. No new or deleted defects.")
    else:
        print(f"CSV file not found at {csv_path}")

    db.commit()
    db.close()

if __name__ == "__main__":
    seed_database()
