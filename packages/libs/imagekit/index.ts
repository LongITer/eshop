import ImageKit from "imagekit";

let instance: ImageKit | null = null;

const getInstance = () => {
  if (!instance) {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    if (!publicKey || !privateKey || !urlEndpoint) {
      throw new Error(
        "ImageKit environment variables are missing (IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, or IMAGEKIT_URL_ENDPOINT)."
      );
    }
    instance = new ImageKit({ publicKey, privateKey, urlEndpoint });
  }
  return instance;
};

export const imageKit = new Proxy({} as ImageKit, {
  get: (target, prop) => {
    const inst = getInstance();
    const value = (inst as any)[prop];
    if (typeof value === "function") {
      return value.bind(inst);
    }
    return value;
  },
});

