

console.log('TensorFlow.js version:', tf.version.tfjs);


var confidenceThreshold = 0.5;

var ApplicationState = {
    model: null,
    canvasContext: document.getElementById('canvas').getContext('2d'),
    videoStream: null,
    isWebcamActive: false,
    frameRate: 20,
    showVideo: false,
    selectedImageFile: null,
    frameTimes: []
};

function HandleModelChange(event) {
    const selectedModel = event.target.value;
    console.log(`Loading model: ${selectedModel}`);
    cocoSsd.load({ base: selectedModel }).then(loadedModel => {
        ApplicationState.model.dispose(); // Dispose of the old model
        ApplicationState.model = loadedModel;
        ApplicationState.model.detect(document.createElement('canvas')); // Warm up new model
        console.log(`Model ${selectedModel} loaded.`);
    });
}
async function handleImageUpload(event) {
    var imageVal;
    if (ApplicationState.showVideo) {
        imageVal = event.target.files[0];
        await stopWebcam();
    }
    ApplicationState.selectedImageFile = event.target.files[0] || imageVal;
    document.getElementById('clearButton').disabled = false;
    processImage();
    document.getElementById('reprocessButton').disabled = false;
}
function processImage() {
    if (!ApplicationState.selectedImageFile) return;
    const reader = new FileReader(); // reads the file
    reader.onload = async function (e) {
        const img = new Image(); // creates new image
        img.src = e.target.result; // sets image source to file data
        img.onload = async function () { // when image is loaded
            const prediction = await ApplicationState.model.detect(img); // make predictions
            console.log('Predictions: ', prediction);
            ApplicationState.canvasContext.canvas.width = img.width;
            ApplicationState.canvasContext.canvas.height = img.height;
            ApplicationState.canvasContext.drawImage(img, 0, 0);
            displayBoundingBoxes(prediction, ApplicationState.canvasContext);
        }
    }
    reader.readAsDataURL(ApplicationState.selectedImageFile);
}

function resetCanvas() {
    ApplicationState.canvasContext.clearRect(0, 0, ApplicationState.canvasContext.canvas.width, ApplicationState.canvasContext.canvas.height);
    document.getElementById("clearButton").disabled = true;
    document.getElementById("reprocessButton").disabled = true;
    ApplicationState.selectedImageFile = null;
    document.getElementById('imageUpload').value = null; // reset file input
}
function handleWebcam() {
    resetCanvas();
    document.getElementById('stopWebcamButton').disabled = false;
    ApplicationState.showVideo = true;
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();
            video.onloadeddata = async () => {
                ApplicationState.canvasContext.canvas.width = video.videoWidth;
                ApplicationState.canvasContext.canvas.height = video.videoHeight;
                const displayVideo = async () => {
                    if (!ApplicationState.showVideo) {
                        stream.getTracks().forEach(track => track.stop());
                        return;
                    }

                    ApplicationState.canvasContext.drawImage(video, 0, 0, ApplicationState.canvasContext.canvas.width, ApplicationState.canvasContext.canvas.height);
                    ApplicationState.model.detect(video).then(prediction => {
                        ;
                        displayBoundingBoxes(prediction, ApplicationState.canvasContext);
                    });
                    const endTime = performance.now();
                    const delta = endTime - (ApplicationState.lastLoopTime || 0);
                    ApplicationState.lastLoopTime = endTime;

                    // Rolling average logic (smoothing)
                    ApplicationState.frameTimes.push(delta);
                    if (ApplicationState.frameTimes.length > 20) ApplicationState.frameTimes.shift();
                    const averageDelta = ApplicationState.frameTimes.reduce((a, b) => a + b) / ApplicationState.frameTimes.length;

                    const currentFPS = (1000 / averageDelta).toFixed(1);

                    // UI Updates
                    document.getElementById('fpsDisplay').innerText = `FPS: ${currentFPS}`;
                    if (ApplicationState.frameRate > 0) {
                        setTimeout(displayVideo, 1000 / ApplicationState.frameRate); // process based on frame rate
                    } else {
                        requestAnimationFrame(displayVideo);
                    }
                };
                displayVideo();
                // process based on frame rate
            };
        })
        .catch(err => {
            console.error("Error accessing webcam: ", err);// display error 
            document.getElementById('stopWebcamButton').disabled = true;
        });
}
async function stopWebcam() {
    ApplicationState.showVideo = false;
    document.getElementById('stopWebcamButton').disabled = true;
    resetCanvas();
};
function displayBoundingBoxes(predictions, ctx) {
    predictions.forEach(prediction => {
        if (prediction.score < confidenceThreshold) return; // skip low confidence
        ctx.beginPath(); // begin drawing
        ctx.rect(...prediction.bbox); // draws rectangle of bounding box
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'red';
        ctx.fillStyle = 'red';
        ctx.stroke();
        ctx.fillText(
            `${prediction.class} (${(prediction.score * 100).toFixed(1)}%)`,
            prediction.bbox[0],
            prediction.bbox[1] > 10 ? prediction.bbox[1] - 5 : 10
        );
    });
}

function saveCanvasImage() {
    const link = document.createElement('a');
    const fileName = `annotated_image_${Date.now()}.png`;
    link.download = fileName;
    link.href = ApplicationState.canvasContext.canvas.toDataURL();
    link.click();
}
document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
document.getElementById('webcamButton').addEventListener('click', handleWebcam);
var main = async () => {
    console.log('Loading COCO-SSD model...');
    ApplicationState.model = await cocoSsd.load();
    console.log('COCO-SSD model loaded. Warming up...');
    ApplicationState.model.detect(document.createElement('canvas'));
    console.log('Model is ready.');
    ApplicationState.videoStream = document.createElement('video');
    console.log(ApplicationState.model)
}

document.getElementById('saveButton').addEventListener('click', saveCanvasImage);
document.getElementById('stopWebcamButton').addEventListener('click', () => {
    stopWebcam();
});
document.getElementById('confidenceThreshold').addEventListener('input', (event) => {
    confidenceThreshold = event.target.value;
    document.getElementById('confidenceValue').innerText = confidenceThreshold;
});
document.getElementById('clearButton').addEventListener('click', () => {
    resetCanvas();
});

document.getElementById('frameRateSlider').addEventListener('input', (event) => {
    ApplicationState.frameRate = event.target.value;
    document.getElementById('frameRateValue').innerText = ApplicationState.frameRate > 0 ? ApplicationState.frameRate : 'MAX';
});

document.getElementById('reprocessButton').addEventListener('click', () => {
    processImage();
});

document.getElementById('modelSelect').addEventListener('change', HandleModelChange);
addEventListener('DOMContentLoaded', main);
addEventListener('abort', () => {
    ApplicationState.model.dispose();
});