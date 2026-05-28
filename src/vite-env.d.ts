/// <reference types="vite/client" />

type MercuryRuntimeInfo = {
  platform: NodeJS.Platform;
  versions: {
    chrome: string;
    electron: string;
    node: string;
  };
};

interface Window {
  mercury?: MercuryRuntimeInfo;
}
