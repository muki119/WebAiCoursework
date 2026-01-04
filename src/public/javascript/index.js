console.log('TensorFlow.js version:', tf.version.tfjs);
import MaxHeap from "./maxHeap.js";
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
    classCounts: new Map(), // Map to hold counts of detected classes in a frame
    classColorsMap: new Map(), // Map to hold colors assigned to each class
    topPredictionsHeap: null, // MaxHeap to hold top predictions based on confidence
};

const modelMetadata = {
    'lite_mobilenet_v2': {
        name: 'Lite MobileNet V2',
        version: '2.0',
        sizeMB: 18.0,
    },
    'mobilenet_v2': {
        name: 'MobileNet V2',
        version: '2.0.0',
        sizeMB: 67.3,
    },
    'mobilenet_v1': {
        name: 'SSD MobileNet V1',
        version: '1.0.0',
        sizeMB: 26.5,
    },
}

const selectElements = {
    backendSelect: document.getElementById('backendSelect'),
    modelSelect: document.getElementById('modelSelect'),
};
const buttonElements = {
    saveButton: document.getElementById('saveButton'),
    clearButton: document.getElementById('clearButton'),
    webcamButton: document.getElementById('webcamButton'),
    stopWebcamButton: document.getElementById('stopWebcamButton'),
    reprocessButton: document.getElementById('reprocessButton'),
}
const inputElements = {
    imageUpload: document.getElementById('imageUpload'),
    confidenceThreshold: document.getElementById('confidenceThreshold'),
    frameRateSlider: document.getElementById('frameRateSlider'),
};

const displayElements = {
    fpsDisplay: document.getElementById('fpsDisplay'),
    infoDisplay: document.getElementById('infoDisplay'),
    confidenceValue: document.getElementById('confidenceValue'),
    frameRateValue: document.getElementById('frameRateValue'),
    classesDetected: document.getElementById('classesDetected'),
    excludedClasses: document.getElementById('excludedClasses'),
    classCountsTable: document.getElementById('classCountsTable'),
    classCountsBody: document.getElementById('classCountsBody'),
    modelName: document.getElementById('modelName'),
    modelVersion: document.getElementById('modelVersion'),
    modelSize: document.getElementById('modelSize'),
    detectionRanksBody: document.getElementById('detectionRanksBody'), // tbody for detection ranks
};



function generateColorForClass(className) {
    //using a hash function to generate a consistent color for each class
    //allows for expanding to many classes without running out of colors
    // using the djb2 hash function - was the easiest to implement and gives good distribution
    //using hue because it gives a wide range of colors and faster to compute instead of full rgb or hex
    let hash = 5381;
    for (let i = 0; i < className.length; i++) {
        hash = ((hash << 5) + hash) + className.charCodeAt(i);
    }
    const hue = hash % 360; // hue between 0-359
    return `hsl(${hue}, 70%, 50%)`;
}


function getColorForClass(className) {
    if (ApplicationState.classColorsMap.has(className)) {
        return ApplicationState.classColorsMap.get(className);
    } else {
        const color = generateColorForClass(className);
        console.log('Generated color for', className, ':', color);
        ApplicationState.classColorsMap.set(className, color);
        return color;
    }
}


function disableAllInteractiveElements() {
    var interactiveElements = document.querySelectorAll('button, input, select');
    interactiveElements.forEach(element => {
        if (element.id === 'stopWebcamButton' && ApplicationState.showVideo) return; // keep stop button enabled if webcam is active
        if (element.id === 'clearButton' && !ApplicationState.selectedImageFile) return; // keep clear button disabled if no image
        if (element.id === 'reprocessButton' && !ApplicationState.selectedImageFile) return; // keep reprocess button disabled if no image
        console.log('Disabling element:', element);
        element.disabled = true;
    });
}
function enableAllInteractiveElements() {
    var interactiveElements = document.querySelectorAll('button, input, select');
    interactiveElements.forEach(element => {
        if (element.id === 'stopWebcamButton' && !ApplicationState.showVideo) return; // keep stop button disabled if webcam is not active
        if (element.id === 'clearButton' && !ApplicationState.selectedImageFile) return; // keep clear button disabled if no image
        if (element.id === 'reprocessButton' && !ApplicationState.selectedImageFile) return; // keep reprocess button disabled if no image
        console.log('Enabling element:', element);
        element.disabled = false;
    });
}


function handleModelChange(event) {
    const selectedModel = event.target.value;
    changeModel(selectedModel);
}
function changeModel(selectedModel) {
    displayInfoMessage(`Loading model: ${selectedModel}...`);
    disableAllInteractiveElements();
    cocoSsd.load({ base: selectedModel }).then(loadedModel => {
        ApplicationState.model?.dispose(); // Dispose of the old model
        ApplicationState.model = loadedModel;
        ApplicationState.model.detect(document.createElement('canvas')); // Warm up new model
        displayModelInfo(selectedModel);
    }).catch(err => {
        displayInfoMessage(`Error loading model: ${err}`);
        console.error("Error loading model: ", err);
    }).finally(() => {
        enableAllInteractiveElements();
        resetClassesDetected();
        hideInfoMessage();
        console.log(ApplicationState.model);
    });

}

function displayInfoMessage(message, ...args) {
    const color = args[0] || 'black';
    displayElements.infoDisplay.style.color = color;
    if (displayElements.infoDisplay.style.display === 'none') {
        displayElements.infoDisplay.style.display = 'block';
    }
    displayElements.infoDisplay.innerText = message;
}
function hideInfoMessage() {
    displayElements.infoDisplay.style.display = 'none';
    displayElements.infoDisplay.innerText = '';
}


async function handleImageUpload(event) {
    var imageVal;
    if (ApplicationState.showVideo) {
        imageVal = event.target.files[0];
        await stopWebcam();
    }
    resetClassesDetected();
    ApplicationState.selectedImageFile = event.target.files[0] || imageVal;
    buttonElements.clearButton.disabled = false;
    processImage();
    buttonElements.reprocessButton.disabled = false;
}
function processImage() {
    if (!ApplicationState.selectedImageFile) return;
    const reader = new FileReader(); // reads the file
    reader.onload = async function (e) {
        const img = new Image(); // creates new image
        img.src = e.target.result; // sets image source to file data
        img.onload = async function () { // when image is loaded
            const prediction = await ApplicationState.model.detect(img); // make predictions
            ApplicationState.canvasContext.canvas.width = img.width;
            ApplicationState.canvasContext.canvas.height = img.height;
            ApplicationState.canvasContext.drawImage(img, 0, 0);
            displayBoundingBoxes(prediction, ApplicationState.canvasContext);
        }
    }
    reader.readAsDataURL(ApplicationState.selectedImageFile);
}

function resetCanvas() {
    resetClassesDetected();
    ApplicationState.canvasContext.clearRect(0, 0, ApplicationState.canvasContext.canvas.width, ApplicationState.canvasContext.canvas.height);
    buttonElements.clearButton.disabled = true;
    buttonElements.reprocessButton.disabled = true;
    ApplicationState.selectedImageFile = null;
    inputElements.imageUpload.value = null; // reset file input
    ApplicationState.topPredictionsHeap = null;
}
function handleWebcam() {
    resetCanvas();
    resetClassesDetected();

    buttonElements.stopWebcamButton.disabled = false;
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
                    ApplicationState.classCounts.clear();

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
                    displayElements.fpsDisplay.innerText = `FPS: ${currentFPS}`;
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
            if (err.name === 'NotAllowedError') {
                displayInfoMessage('Webcam access denied. Please allow webcam access and try again.', 'red');
                return;
            }
            displayInfoMessage(`Error accessing webcam: ${err}`);

        });
};
async function stopWebcam() {
    ApplicationState.showVideo = false;
    buttonElements.stopWebcamButton.disabled = true;
    resetCanvas();
    resetClassesDetected();
};

async function displayClassesDetected() {
    // display detected classes as buttons that when clicked filter the bounding boxes
    if (ApplicationState.classesSet.size === ApplicationState.prevClassesSet.size && ApplicationState.classesSet.difference(ApplicationState.prevClassesSet).size === 0) return; // no change
    ApplicationState.prevClassesSet = new Set(ApplicationState.classesSet);
    displayElements.classesDetected.innerHTML = '';
    ApplicationState.classesSet.forEach(className => {
        if (ApplicationState.noDisplaySet.has(className)) return; // skip if in no display set
        const button = document.createElement('button');
        button.classList.add('classButton');
        button.innerText = className;
        button.onclick = () => {
            ApplicationState.noDisplaySet.add(className);
            ApplicationState.classesSet.delete(className);
            ApplicationState.classCounts.clear();
            console.log(`Filtering out class: ${className}`);
            displayClassesDetected();
            if (ApplicationState.selectedImageFile) processImage();
        };
        displayElements.classesDetected.appendChild(button);
    });
    displayExcludedClasses();
}

function displayClassCounts() {
    displayElements.classCountsBody.innerHTML = ''; // clear previous
    ApplicationState.classCounts.forEach((count, className) => {
        const row = document.createElement('tr');
        const classCell = document.createElement('td');
        classCell.innerText = className;
        const colorCell = document.createElement('td');
        colorCell.classList.add('colorCell');
        const colorBox = document.createElement('div');
        colorBox.style.width = '20px';
        colorBox.style.height = '20px';
        colorBox.style.backgroundColor = getColorForClass(className);
        colorCell.appendChild(colorBox);
        row.appendChild(colorCell);
        row.appendChild(classCell);
        const countCell = document.createElement('td');
        countCell.innerText = count;
        row.appendChild(classCell);
        row.appendChild(countCell);
        displayElements.classCountsBody.appendChild(row);
    });
}

function displayExcludedClasses() {
    displayElements.excludedClasses.innerHTML = ''; // clear previous
    displayElements.excludedClasses.innerHTML = ''; // clear previous
    ApplicationState.noDisplaySet.forEach(className => {
        const button = document.createElement('button');
        button.classList.add('classButton');
        button.innerText = className;
        button.onclick = () => {
            ApplicationState.noDisplaySet.delete(className);
            ApplicationState.classesSet.add(className);
            displayExcludedClasses();
            ApplicationState.classCounts.clear();
            if (ApplicationState.selectedImageFile) processImage();
        };
        displayElements.excludedClasses.appendChild(button);
    });
}

function resetClassesDetected() {
    ApplicationState.classesSet.clear();
    ApplicationState.noDisplaySet.clear();
    ApplicationState.prevClassesSet.clear();
    ApplicationState.classCounts.clear();
    ApplicationState.topPredictionsHeap = null;
    displayElements.classesDetected.innerHTML = ''; // clear display
    displayElements.detectionRanksBody.innerHTML = '';

}

function addClassDetection(prediction) {
    const className = prediction.class;
    //update max heap
    const strippedPrediction = {
        class: prediction.class,
        score: prediction.score,
    };
    if (!ApplicationState.topPredictionsHeap) {
        ApplicationState.topPredictionsHeap = new MaxHeap([strippedPrediction], (a, b) => a.score > b.score);
    } else {
        ApplicationState.topPredictionsHeap.insert(strippedPrediction);
    }
    // Update count
    const currentCount = ApplicationState.classCounts.get(className) || 0;
    ApplicationState.classCounts.set(className, currentCount + 1);
}

const toOrdinal = (n) => {
    var stringNumber = n.toString();
    var lastDigit = stringNumber.charAt(stringNumber.length - 1);
    if (lastDigit == `1`) {
        return stringNumber + 'st';
    } else if (lastDigit == `2`) {
        return stringNumber + 'nd';
    } else if (lastDigit == `3`) {
        return stringNumber + 'rd';
    } else {
        return stringNumber + 'th';
    }
}


function displayDetectionRanks() {
    displayElements.detectionRanksBody.innerHTML = ''; // clear previous
    if (!ApplicationState.topPredictionsHeap) return;
    const sortedPredictions = ApplicationState.topPredictionsHeap.sort();
    sortedPredictions.forEach(prediction => {
        const row = document.createElement('tr');
        const rankCell = document.createElement('td');
        rankCell.innerText = toOrdinal(displayElements.detectionRanksBody.children.length + 1);
        row.appendChild(rankCell);
        const classCell = document.createElement('td');
        classCell.innerText = prediction.class;
        row.appendChild(classCell);
        const scoreCell = document.createElement('td');
        scoreCell.innerText = (prediction.score * 100).toFixed(1) + '%';
        row.appendChild(scoreCell);
        displayElements.detectionRanksBody.appendChild(row);
    });
}


function displayBoundingBoxes(predictions, ctx) {
    ApplicationState.topPredictionsHeap = null;
    for (const prediction of predictions) {
        addClassDetection(prediction);
        if (ApplicationState.noDisplaySet.has(prediction.class)) continue; // skip filtered classes
        ApplicationState.classesSet.add(prediction.class);
        if (prediction.score < ApplicationState.confidenceThreshold) continue; // skip low confidence
        ctx.beginPath(); // begin drawing
        ctx.rect(...prediction.bbox); // draws rectangle of bounding box
        ctx.lineWidth = 8;
        ctx.strokeStyle = getColorForClass(prediction.class);
        ctx.fillStyle = getColorForClass(prediction.class);
        ctx.stroke();
        ctx.fillText(
            `${prediction.class} (${(prediction.score * 100).toFixed(1)}%)`,
            prediction.bbox[0],
            prediction.bbox[1] > 10 ? prediction.bbox[1] - 5 : 10
        );
    };
    console.log("predictions ranked by confidence:", ApplicationState.topPredictionsHeap ? ApplicationState.topPredictionsHeap.sort() : []);
    displayDetectionRanks();
    displayClassesDetected();
    displayClassCounts();
}

function saveCanvasImage() {
    const link = document.createElement('a');
    const fileName = `annotated_image_${Date.now()}.png`;
    link.download = fileName;
    link.href = ApplicationState.canvasContext.canvas.toDataURL();
    link.click();
}


function displayBackendOptions() {
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
        selectElements.backendSelect.appendChild(option);
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


function displayModelInfo(name) {
    if (!ApplicationState.model) return;
    displayElements.modelName.innerText = `${modelMetadata[name]?.name || 'Unknown'}`;
    displayElements.modelVersion.innerText = `${modelMetadata[name]?.version || 'Unknown'}`;
    displayElements.modelSize.innerText = ` ≈ ${modelMetadata[name]?.sizeMB ? modelMetadata[name].sizeMB.toFixed(2) + ' MB' : 'Unknown'}`;
}
var main = async () => {
    displayBackendOptions();
    console.log('Loading COCO-SSD model...');
    changeModel('lite_mobilenet_v2');
    ApplicationState.videoStream = document.createElement('video');

}


document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
document.getElementById('webcamButton').addEventListener('click', handleWebcam);

buttonElements.saveButton.addEventListener('click', saveCanvasImage);
buttonElements.stopWebcamButton.addEventListener('click', stopWebcam);
inputElements.confidenceThreshold.addEventListener('input', (event) => {
    ApplicationState.confidenceThreshold = event.target.value;
    displayElements.confidenceValue.innerText = ApplicationState.confidenceThreshold;
});
buttonElements.clearButton.addEventListener('click', resetCanvas);
inputElements.frameRateSlider.addEventListener('input', (event) => {
    ApplicationState.frameRate = event.target.value;
    displayElements.frameRateValue.innerText = ApplicationState.frameRate > 0 ? ApplicationState.frameRate : 'MAX';
});
buttonElements.reprocessButton.addEventListener('click', processImage);
selectElements.backendSelect.addEventListener('change', HandleBackendChange);
selectElements.modelSelect.addEventListener('change', handleModelChange);
addEventListener('DOMContentLoaded', main);
addEventListener('abort', () => { // cleanup on page unload
    ApplicationState.model.dispose();
});
