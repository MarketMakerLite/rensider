declare module 'unzipper' {
  import { Readable } from 'stream';

  interface File {
    path: string;
    type: 'File' | 'Directory';
    stream(): Readable;
  }

  interface Directory {
    files: File[];
  }

  export const Open: {
    file(path: string): Promise<Directory>;
  };

  export function Extract(options: { path: string }): NodeJS.WritableStream;
}
