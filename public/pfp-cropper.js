
const canvas = document.getElementById('canvas');
const fileInput = document.getElementById('fileInput');
fileInput.addEventListener('change', () => fileInputOnChange(fileInput, canvas));