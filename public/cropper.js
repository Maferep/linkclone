// TODO: test with extreme images (very small width or height)
loadFileToInput = (file, fileInput) => {
  // Load img blob to input
  // WIP: UTF8 character error
  let container = new DataTransfer(); 
  container.items.add(file);
  fileInput.files = container.files;
}

let doCropCanvas = (canvas, img) => {
  boxsize = Math.min(img.naturalWidth, img.naturalHeight);
  console.assert(img.naturalHeight > 0, message="bad height")
  console.assert(img.naturalWidth > 0, message="bad width")
  if(img.naturalHeight <= 0 || img.naturalWidth <= 0) {
    return
  }
  // Set canvas dimensions to desired crop size
  const cropWidth = boxsize;
  const cropHeight = boxsize;
  console.log("image:", img)
  canvas.width = cropWidth;
  canvas.height = cropHeight;

  // Draw the cropped portion of the image on the canvas
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
}


let cropCanvasToFileInput = (img, canvas, fileInput) => {
  doCropCanvas(canvas, img);

  // Turn cropped canvas into file and load it in file input
  canvas.toBlob((blob) => {
    let file = new File([blob], "fileName.jpg", { type: "image/jpeg" });
    loadFileToInput(file, fileInput)
  }, 'image/jpeg');
};

fileInputOnChange = (fileInput, canvas) => {
  // set up cropper reader
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.src = event.target.result;
    img.onload = () => cropCanvasToFileInput(img, canvas, fileInput);
  };

  // load file onto reader
  const file = fileInput.files[0];
  if (file) {
    reader.readAsDataURL(file);
  }
}

