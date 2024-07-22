package com.example.backend.controller;

import com.example.backend.service.FileService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRange;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "http://localhost:4200")
public class FileController {

    private final FileService fileService;

    public FileController(FileService fileService) {
        this.fileService = fileService;
    }

    @PostMapping("/upload-chunk")
    public ResponseEntity<String> uploadChunk(
            @RequestParam("file") MultipartFile file,
            @RequestParam("chunkNumber") int chunkNumber,
            @RequestParam("totalChunks") int totalChunks) {
        try {
            return fileService.uploadChunk(file, chunkNumber, totalChunks);
        } catch (IOException e) {
            return ResponseEntity.status(500).body("{\"error\": \"Error processing file chunk: " + e.getMessage() + "\"}");
        }
    }

    @GetMapping("/list-uploaded-files")
    public ResponseEntity<List<String>> listUploadedFiles() {
        List<String> files = fileService.listUploadedFiles();
        return ResponseEntity.ok(files);
    }

    @GetMapping("/download/{fileName}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String fileName, @RequestHeader HttpHeaders headers) {
        Resource file = fileService.downloadFile(fileName);
        HttpRange range = headers.getRange().isEmpty() ? null : headers.getRange().get(0);

        return fileService.prepareResponseEntity(file, range);
    }
}
