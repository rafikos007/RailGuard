from ultralytics import YOLO

def main():
    # Load the pretrained YOLOv8s model
    model = YOLO("yolov8s.pt")
    
    # Train the model on the newly added Dataset
    # You can adjust epochs and batch_size based on your GPU capabilities
    print("Starting training on Dataset/data.yaml...")
    results = model.train(
        data="Dataset/data.yaml", 
        epochs=50, 
        imgsz=640, 
        batch=16, 
        project="runs/detect", 
        name="train_pfe"
    )
    print("Training finished successfully. The best model will be saved in runs/detect/train_pfe/weights/best.pt")

if __name__ == "__main__":
    main()
