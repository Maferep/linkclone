let someJavascript = (fileInput, event) => { // aka 'this'
    //find canvas using DOM travelling
    const localParent = fileInput.parentElement.parentElement
    const canvas = localParent.querySelector("canvas")
    // call cropper function
    fileInputOnChange(fileInput, canvas);
}

window.addEventListener("load",() => {
    let images = document.getElementsByClassName("reference-img-invisible")
    // TODO concurrent
    for (let i = 0; i < images.length; i++) {
        let parent = images[i].parentElement;
        let canvas = parent.querySelector("canvas")
        // preload onto canvas
        let image = images[i]
        console.log(image)
        console.log(canvas)
        doCropCanvas(canvas, image)
    }
})