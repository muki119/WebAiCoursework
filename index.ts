import express from 'express';
import path from "node:path"
import { fileURLToPath } from 'node:url';
const app = express();
const port: number = 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "./src/public")));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "./src/views/index.html"));
});

var server = app.listen(port, function () {
    console.log(`Server is running on port ${port}`);
});


process.on('SIGINT', function () {
    console.log("Shutting down server...");
    server.close(function () {
        console.log("Server shut down.");
        process.exit(0);
    });
});