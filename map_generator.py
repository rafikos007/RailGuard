import pandas as pd
import folium
import os
import sqlite3

def generate_map(output_html='railway_defects_map.html', 
                 images_dir='backend/images'):
    
    # 1. Connexion à la base de données SQLite
    db_path = 'backend/railways.db'
    if not os.path.exists(db_path):
        # Tentative de chemin alternatif si lancé depuis un autre dossier
        db_path = os.path.join(os.path.dirname(__file__), 'backend', 'railways.db')
        if not os.path.exists(db_path):
            print(f"Erreur : Impossible de trouver la base de données à '{db_path}'.")
            return

    print(f"Lecture des données depuis la base de données SQLite...")
    try:
        conn = sqlite3.connect(db_path)
        # On récupère les défauts actifs (table 'defects')
        query = "SELECT image_path as image, defect_class as defect, confidence, lat, lon, date_detected as date FROM defects"
        df = pd.read_sql_query(query, conn)
        conn.close()
    except Exception as e:
        print(f"Erreur lors de la lecture de la base de données : {e}")
        return
    
    if df.empty:
        print("Aucun défaut actif à afficher sur la carte.")
        # Créer une carte par défaut sur l'Algérie si vide pour éviter une page blanche
        m = folium.Map(location=[36.7, 3.0], zoom_start=6)
        m.save(output_html)
        return

    # 2. Nettoyage et formatage
    df['defect'] = df['defect'].astype(str).str.strip().str.lower()
    
    # 3. Calcul du centre de la carte
    avg_lat = df['lat'].mean()
    avg_lon = df['lon'].mean()
    
    # 4. Génération de la carte de base
    m = folium.Map(location=[avg_lat, avg_lon], zoom_start=15, tiles='OpenStreetMap')
    
    # Style pour l'animation de pulsation (rouge uniquement pour les fissures)
    pulse_css = """
    <style>
    @keyframes pulse-danger {
        0% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7); transform: scale(1); }
        50% { box-shadow: 0 0 0 10px rgba(255, 0, 0, 0); transform: scale(1.1); }
        100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); transform: scale(1); }
    }
    .danger-marker { animation: pulse-danger 1.5s infinite; }
    </style>
    """
    m.get_root().header.add_child(folium.Element(pulse_css))
    
    defect_colors = {
        'crack': 'red',
        'fissure': 'red',
        'squat': 'orange',
        'spalling': 'yellow',
        'écaillage': 'yellow',
        'joints': 'blue',
        'joint': 'blue'
    }

    print(f"Ajout de {len(df)} marqueurs issus de la base de données...")

    # 5. Ajout des marqueurs
    for _, row in df.iterrows():
        defect_type = row['defect']
        # Traduction pour l'affichage
        defect_type_fr = {
            "crack": "fissure", 
            "squat": "squat", 
            "spalling": "écaillage", 
            "joint": "joint", 
            "joints": "joint"
        }.get(defect_type, defect_type)
        
        lat, lon = row['lat'], row['lon']
        image_name = row['image']
        confidence = row['confidence']
        date_str = str(row['date'])
        
        color = defect_colors.get(defect_type, 'gray')
        
        # Pour l'affichage dans le dashboard, on utilise l'URL servie par FastAPI
        img_url = f"http://localhost:8000/images/{image_name}"
        
        popup_html = f"""
        <div style="font-family: 'Segoe UI', sans-serif; min-width: 200px; padding: 5px;">
            <h4 style="margin: 0 0 8px 0; color: {color if color != 'yellow' else '#d4a017'}; text-transform: capitalize; border-bottom: 1px solid #ddd;">
                {defect_type_fr}
            </h4>
            <div style="font-size: 13px; line-height: 1.6;">
                <b>Date :</b> {date_str}<br>
                <b>Confiance :</b> {confidence:.2%}<br>
                <b>Coordonnées :</b> {lat:.6f}, {lon:.6f}
            </div>
            <div style="margin-top: 10px; text-align: center;">
                <img src="{img_url}" style="width: 100%; max-width: 250px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
            </div>
        </div>
        """
        
        marker_html = f"""
        <div class="{'danger-marker' if color == 'red' else ''}" style="
            background-color: {color};
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 5px rgba(0,0,0,0.5);
        "></div>
        """
        
        folium.Marker(
            location=[lat, lon],
            icon=folium.DivIcon(html=marker_html, icon_anchor=(7, 7)),
            popup=folium.Popup(popup_html, max_width=300),
            tooltip=f"{defect_type_fr.capitalize()} ({confidence:.1%})"
        ).add_to(m)

    # 6. Sauvegarde
    m.save(output_html)
    print(f"✅ Carte synchronisée avec SQLite générée : {output_html}")

if __name__ == '__main__':
    generate_map()
