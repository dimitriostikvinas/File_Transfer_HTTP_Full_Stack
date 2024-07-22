package com.example.backend.service;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpRange;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.ByteArrayResource;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class FileService {
    private static final String UPLOAD_DIR = "uploads/";

    public ResponseEntity<String> uploadChunk(MultipartFile file, int chunkNumber, int totalChunks) throws IOException {
        File uploadFile = new File(UPLOAD_DIR + file.getOriginalFilename());
        try (RandomAccessFile raf = new RandomAccessFile(uploadFile, "rw")) {
            long offset = (long) chunkNumber * (1024 * 1024);
            raf.seek(offset);
            raf.write(file.getBytes());
        }
        return ResponseEntity.ok("{\"message\": \"Chunk uploaded successfully\"}");
    }

    public List<String> listUploadedFiles() {
        try {
            return Files.list(Paths.get(UPLOAD_DIR))
                    .map(Path::getFileName)
                    .map(Path::toString)
                    .collect(Collectors.toList());
        } catch (IOException e) {
            throw new RuntimeException("Failed to list uploaded files", e);
        }
    }

    public Resource downloadFile(String fileName) {
        return new FileSystemResource(Paths.get(UPLOAD_DIR).resolve(fileName).toFile());
    }

    public ResponseEntity<Resource> prepareResponseEntity(Resource file, HttpRange range) {
        try {
            File fileToDownload = file.getFile();
            long fileLength = fileToDownload.length();

            if (range == null) {
                return ResponseEntity.ok()
                        .header("Content-Disposition", "attachment; filename=\"" + fileToDownload.getName() + "\"")
                        .header("Content-Length", String.valueOf(fileLength))
                        .body(file);
            }

            long start = range.getRangeStart(0);
            long end = range.getRangeEnd(fileLength - 1);
            long contentLength = end - start + 1;

            InputStream inputStream = new FileInputStream(fileToDownload);
            inputStream.skip(start);

            return ResponseEntity.status(206)
                    .header("Content-Disposition", "attachment; filename=\"" + fileToDownload.getName() + "\"")
                    .header("Content-Length", String.valueOf(contentLength))
                    .header("Content-Range", "bytes " + start + "-" + end + "/" + fileLength)
                    .body(new ByteArrayResource(StreamUtils.copyToByteArray(inputStream)));
        } catch (IOException e) {
            throw new RuntimeException("Error preparing file response", e);
        }
    }
}
