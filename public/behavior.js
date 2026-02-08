/** @param {HTMLElement} copyicon */
function linktoclipboard(copyicon, url) {
  navigator.clipboard.writeText(url)
}


window.addEventListener("load",() => {
  // used by card preview to hide 'edit links'
  const inIframe = window.self !== window.top;

  let editLinks = document.querySelector(".edit-links-button")
  console.log("edit links:", editLinks)
  if(editLinks && inIframe) {
    editLinks.style.display = "none"
  } 
})
