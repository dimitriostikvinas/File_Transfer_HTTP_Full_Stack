import { Component, HostListener, OnInit } from '@angular/core';
import { FileUploadService } from './file-upload.service';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  uploadedFiles: File[] = [];
  uploadedFilesList: string[] = [];
  totalSize: number = 0;
  totalSizePercent: number = 0;
  fileUploaded: boolean = false;
  selectedFileName: string = '';
  maxFileSize: number = 0; // Dynamic based on actual file size
  uploadSubscriptions: Subscription[] = []; // To track upload subscriptions

  constructor(
    private fileUploadService: FileUploadService,
    private messageService: MessageService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.refreshUploadedFiles();
  }

  onFileSelect(event: any) {
    const files = event.files;
    this.totalSize = 0;
    this.uploadedFiles = [];

    for (let file of files) {
      if (file.type !== 'text/csv') {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Only CSV files are allowed.',
        });
        return;
      }
      this.uploadedFiles.push(file);
      this.totalSize += file.size;
    }

    this.maxFileSize = this.totalSize; // Set maxFileSize to the total size of selected files
    this.totalSizePercent = 0; // Reset the progress bar
    this.cd.detectChanges(); // Trigger change detection
  }

  onClearFiles() {
    this.uploadedFiles = [];
    this.totalSize = 0;
    this.totalSizePercent = 0;
    this.fileUploaded = false;
    this.uploadSubscriptions.forEach((sub) => sub.unsubscribe()); // Cancel all uploads
    this.uploadSubscriptions = []; // Clear subscriptions
    this.cd.detectChanges(); // Trigger change detection
  }

  formatSize(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024,
      dm = 2,
      sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'],
      i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  async uploadFiles() {
    const maxChunkSize = 1024 * 1024; // 1MB
    for (let file of this.uploadedFiles) {
      this.selectedFileName = file.name; // Set the file name for download

      let chunkNumber = 0;
      const totalChunks = Math.ceil(file.size / maxChunkSize);
      for (let start = 0; start < file.size; start += maxChunkSize) {
        const end = Math.min(start + maxChunkSize, file.size);
        const chunk = file.slice(start, end);
        await this.uploadChunk(file, chunk, ++chunkNumber, totalChunks);
        this.totalSizePercent = Math.round((chunkNumber / totalChunks) * 100); // Update progress bar
        this.cd.detectChanges(); // Trigger change detection
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'File uploaded successfully.',
      });
      this.uploadedFilesList.push(file.name); // Add file to uploaded files list

      // Remove the file from the uploaded files list and update the UI
      this.uploadedFiles = this.uploadedFiles.filter((f) => f !== file);
      this.totalSize = this.uploadedFiles.reduce((acc, f) => acc + f.size, 0); // Recalculate total size
      this.totalSizePercent = 0; // Reset the progress bar
      this.fileUploaded = false; // Reset the file upload status
      this.cd.detectChanges(); // Trigger change detection

      // Refresh the uploaded files list
      this.refreshUploadedFiles();
    }
    this.onClearFiles();
  }

  uploadChunk(
    file: File,
    chunk: Blob,
    chunkNumber: number,
    totalChunks: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const uploadSub = this.fileUploadService
        .uploadFileChunk(file, chunk, chunkNumber)
        .subscribe(
          (event) => {
            if (event.type === HttpEventType.UploadProgress) {
              const progress = Math.round((100 * event.loaded) / event.total);
              console.log(
                `Chunk ${chunkNumber} of ${totalChunks} is ${progress}% uploaded.`
              );
            } else if (event instanceof HttpResponse) {
              console.log(
                `Chunk ${chunkNumber} of ${totalChunks} has been uploaded successfully.`
              );
              resolve();
            }
          },
          (error) => {
            console.error('Error uploading chunk', error);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Error uploading file chunk.',
            });
            reject(error);
          }
        );

      this.uploadSubscriptions.push(uploadSub); // Track the subscription
    });
  }

  refreshUploadedFiles() {
    this.fileUploadService.getUploadedFiles().subscribe((files) => {
      this.uploadedFilesList = files;
      this.cd.detectChanges(); // Trigger change detection
    });
  }

  selectFile(fileName: string) {
    this.selectedFileName = fileName;
  }

  async downloadFile(fileName: string) {
    try {
      await this.fileUploadService.downloadFile(fileName);
      this.messageService.add({
        severity: 'success',
        summary: 'Success',
        detail: 'File downloaded successfully.',
      });
    } catch (error) {
      console.error('Error downloading file', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error downloading file.',
      });
    }
  }

  clearFiles() {
    this.onClearFiles();
  }

  cancelUpload(file: File) {
    this.uploadedFiles = this.uploadedFiles.filter((f) => f !== file); // Remove file from upload list
    this.uploadSubscriptions.forEach((sub) => sub.unsubscribe()); // Cancel all uploads
    this.uploadSubscriptions = []; // Clear subscriptions
    this.cd.detectChanges(); // Trigger change detection
  }
}
