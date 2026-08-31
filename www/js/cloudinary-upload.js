// ── Cloudinary config ──
// Cloud name: console home page, top-left, under your account name.
// Upload preset: Settings → Upload → Upload presets (must be "Unsigned").
const CLOUDINARY_CLOUD_NAME = "dbqh5l9ki";
const CLOUDINARY_UPLOAD_PRESET = "dxpline_avatars";

function uploadToCloudinary(file, onSuccess, onError) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  )
    .then((r) => r.json())
    .then((data) => {
      if (data.secure_url) onSuccess(data.secure_url);
      else onError((data.error && data.error.message) || "Upload failed.");
    })
    .catch((err) => onError(err.message));
}
