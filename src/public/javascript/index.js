console.log('TensorFlow.js version:', tf.version.tfjs);




var ApplicationState = {
    model: null,
    canvasContext: document.getElementById('canvas').getContext('2d'),
    videoStream: null,
    isWebcamActive: false,
    frameRate: 20,
    showVideo: false,
    selectedImageFile: null,
    frameTimes: [],
    confidenceThreshold: 0.5,
    classesSet: new Set(),
    prevClassesSet: new Set(),
    noDisplaySet: new Set(),
};

function handleModelChange(event) {
    const selectedModel = event.target.value;
    console.log(`Loading model: ${selectedModel}`);
    cocoSsd.load({ base: selectedModel }).then(loadedModel => {
        ApplicationState.model.dispose(); // Dispose of the old model
        ApplicationState.model = loadedModel;
        ApplicationState.model.detect(document.createElement('canvas')); // Warm up new model
        console.log(`Model ${selectedModel} loaded.`);
    });
    resetClassesDetected();
}
async function handleImageUpload(event) {
    var imageVal;
    if (ApplicationState.showVideo) {
        imageVal = event.target.files[0];
        await stopWebcam();
    }
    resetClassesDetected();
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
    resetClassesDetected();

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
    resetClassesDetected();
};

async function displayClassesDetected() {
    // display detected classes as buttons that when clicked filter the bounding boxes
    if (ApplicationState.classesSet.size === ApplicationState.prevClassesSet.size && ApplicationState.classesSet.difference(ApplicationState.prevClassesSet).size === 0) return; // no change
    ApplicationState.prevClassesSet = new Set(ApplicationState.classesSet);
    var classesDiv = document.getElementById('classesDetected');
    classesDiv.innerHTML = ''; // clear previous
    ApplicationState.classesSet.forEach(className => {
        if (ApplicationState.noDisplaySet.has(className)) return; // skip if in no display set
        const button = document.createElement('button');
        button.innerText = className;
        button.onclick = () => {
            ApplicationState.noDisplaySet.add(className);
            ApplicationState.classesSet.delete(className);
            console.log(`Filtering out class: ${className}`);
            displayClassesDetected();
            if (ApplicationState.selectedImageFile) processImage();
        };
        classesDiv.appendChild(button);
    });
    displayExcludedClasses();
}

function displayExcludedClasses() {
    var excludedDiv = document.getElementById('excludedClasses');
    excludedDiv.innerHTML = ''; // clear previous
    ApplicationState.noDisplaySet.forEach(className => {
        const button = document.createElement('button');
        button.innerText = className;
        button.onclick = () => {
            ApplicationState.noDisplaySet.delete(className);
            ApplicationState.classesSet.add(className);
            console.log(`Including class: ${className}`);
            displayExcludedClasses();
            if (ApplicationState.selectedImageFile) processImage();
        };
        excludedDiv.appendChild(button);
    });
}

function resetClassesDetected() {
    ApplicationState.classesSet.clear();
    ApplicationState.noDisplaySet.clear();
    var classesDiv = document.getElementById('classesDetected');
    classesDiv.innerHTML = ''; // clear display
}
function displayBoundingBoxes(predictions, ctx) {
    for (const prediction of predictions) {
        if (ApplicationState.noDisplaySet.has(prediction.class)) continue; // skip filtered classes
        ApplicationState.classesSet.add(prediction.class);
        if (prediction.score < ApplicationState.confidenceThreshold) continue; // skip low confidence
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
    };
    displayClassesDetected();
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

function displayBackendOptions() {
    const backendSelect = document.getElementById('backendSelect');
    const backends = tf.engine().backendNames();
    backends.forEach(backend => {
        const option = document.createElement('option');
        option.value = backend;
        option.text = backend.charAt(0).toUpperCase() + backend.slice(1);
        if (backend === ApplicationState.backendType) {
            option.selected = true;
        }
        tf.ready().then(() => { // waits for tf backend to be ready before checking
            if (tf.getBackend() === backend) { // if whaat is auto selected by tf is this backend
                option.selected = true;
            }
        });
        console.log('Available backend:', backend);
        console.log('Current backend:', tf.getBackend());
        backendSelect.appendChild(option);
    });
}
function HandleBackendChange(event) {
    const selectedBackend = event.target.value;
    console.log(`Switching to backend: ${selectedBackend}`);
    tf.setBackend(selectedBackend).then(() => {
        ApplicationState.backendType = selectedBackend;
        console.log(`Backend switched to: ${selectedBackend}`);
    });
}
var main = async () => {
    displayBackendOptions();
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
    ApplicationState.confidenceThreshold = event.target.value;
    document.getElementById('confidenceValue').innerText = ApplicationState.confidenceThreshold;
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
document.getElementById('backendSelect').addEventListener('change', HandleBackendChange);

document.getElementById('modelSelect').addEventListener('change', handleModelChange);
addEventListener('DOMContentLoaded', main);
addEventListener('abort', () => {
    ApplicationState.model.dispose();
});