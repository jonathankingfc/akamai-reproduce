// Used to monitor successful push/pulls of Quay.io
// Pushes an OCI manifest image with a single layer

import crypto from "crypto";
import https from "https";

const account = "jonathankingfc";
const password = process.env.QUAY_PASSWORD;
const quayHost = "quay.io";
const org = "jonathankingfc";
const repo = "init";
const tag = "latest";
const uid = crypto.randomUUID();

function sha256(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function base64ToHex(txt: string) {
  return Buffer.from(txt, "base64").toString("hex");
}

function getTarLayer(uid: string) {
  let tar = `test.txtXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX000644 X000765 X000024 X00000000004 14272235173 013207X 0XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXustarX00bcatonXXXXXXXXXXXXXXXXXXXXXXXXXXstaffXXXXXXXXXXXXXXXXXXXXXXXXXXX000000 X000000 XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX${uid}XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`;
  return tar.replace(/X/g, "\0");
}

const layerContent = getTarLayer(uid);
const layerSha = `sha256:${sha256(layerContent)}`;
const configContent = JSON.stringify({
  created: "2015-10-31T22:22:56.015925234Z",
  author: uid,
  architecture: "amd64",
  os: "linux",
  config: {},
  rootfs: {
    diff_ids: [
      "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4",
      "sha256:a3ed95caeb02ffe68cdd9fd84406680ae93d633cb16422d00e8a7c22955b46d4",
    ],
    type: "layers",
  },
  history: [],
});
const configSha = `sha256:${sha256(configContent)}`;
const manifest = JSON.stringify({
  schemaVersion: 2,
  mediaType: "application/vnd.oci.image.manifest.v1+json",
  config: {
    mediaType: "application/vnd.oci.image.config.v1+json",
    size: configContent.length,
    digest: configSha,
  },
  layers: [
    {
      mediaType: "application/vnd.oci.image.layer.v1.tar",
      size: layerContent.length,
      digest: layerSha,
    },
  ],
});

const authHeader = `Basic ${Buffer.from(`${account}:${password}`).toString(
  "base64"
)}`;

function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: string
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: quayHost,
      path,
      method,
      headers,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, data }));
    });
    req.on("error", (err) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

(async function main() {
  try {
    const authResponse = await makeRequest(
      "GET",
      `/v2/auth?account=${account}&scope=repository%3A${org}%2F${repo}%3Apull%2Cpush&service=${quayHost}`,
      {
        Authorization: authHeader,
      }
    );
    const token = JSON.parse(authResponse.data).token;
    const headers = { Authorization: `Bearer ${token}` };

    // get blobs
    // const blobRes = await makeRequest('GET', `/v2/${org}/${repo}/manifests/${tag}`, { ...uploadHeaders }, manifest);
    // console.log(`Blob upload status: ${blobRes.data}`);

    const manifestResponse = await makeRequest(
      "PUT",
      `/v2/${org}/${repo}/manifests/${tag}`,
      {
        ...headers,
        "Content-Type": "application/vnd.oci.image.manifest.v1+json",
      },
      manifest
    );
    console.log(`Manifest upload status: ${manifestResponse.status}`);
    console.log(manifestResponse.data);
  } catch (error) {
    console.error("Error:", error);
  }
})();
