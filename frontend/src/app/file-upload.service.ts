import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as StreamSaver from 'streamsaver';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileUploadService {
  private baseUrl = 'http://localhost:8080/api/files';

  constructor(private http: HttpClient) {}

  uploadFileChunk(
    file: File,
    chunk: Blob,
    chunkNumber: number
  ): Observable<any> {
    const formData: FormData = new FormData();
    formData.append('file', chunk, file.name);
    formData.append('chunkNumber', chunkNumber.toString());
    formData.append(
      'totalChunks',
      Math.ceil(file.size / (1024 * 1024)).toString()
    );

    return this.http.post(`${this.baseUrl}/upload-chunk`, formData, {
      reportProgress: true,
      observe: 'events',
    });
  }

  getUploadedFiles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/list-uploaded-files`);
  }

  async downloadFile(fileName: string): Promise<void> {
    const url = `${this.baseUrl}/download/${fileName}`;
    const fileStream = StreamSaver.createWriteStream(fileName);
    const writer = fileStream.getWriter();
    let receivedBytes = 0;
    let totalBytes = 0;

    const downloadChunk = async (start: number) => {
      const headers = new HttpHeaders().set('Range', `bytes=${start}-`);
      const headersObj: Record<string, string> = {};
      headers.keys().forEach((key) => {
        headersObj[key] = headers.get(key)!;
      });

      const response = await fetch(url, { headers: headersObj });

      if (!response.ok) {
        throw new Error(`Failed to fetch chunk: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get reader from response body');
      }

      const contentRange = response.headers.get('Content-Range');
      if (contentRange) {
        const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
        if (match) {
          totalBytes = parseInt(match[3], 10);
        }
      } else {
        // Fallback: Try to get the content-length if content-range is not available
        totalBytes = parseInt(
          response.headers.get('Content-Length') || '0',
          10
        );
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.length;
          await writer.write(value);

          // Log progress
          console.log(
            `Received ${receivedBytes} of ${totalBytes} bytes (${Math.round(
              (receivedBytes / totalBytes) * 100
            )}%)`
          );
        }
      }

      if (receivedBytes < totalBytes) {
        // Continue downloading the next chunk
        await downloadChunk(receivedBytes);
      } else {
        // All chunks downloaded
        writer.close();
      }
    };

    try {
      await downloadChunk(0);
    } catch (error) {
      console.error('Error downloading file', error);
      writer.abort(error);
    }
  }
}
