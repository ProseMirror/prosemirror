import insertCSS from "insert-css"

insertCSS(`

.ProseMirror-tooltip {
  position: absolute;
  display: none;
  box-sizing: border-box;
  -moz-box-sizing: border- box;
  overflow: hidden;

  -webkit-transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  -moz-transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  opacity: 0;

  border-radius: 5px;
  padding: 5px 7px;
  margin: 0;
  background: #333;
  color: white;

  z-index: 5;
}

.ProseMirror-tooltip-pointer {
  content: "";
  position: absolute;
  display: none;
  width: 0; height: 0;

  -webkit-transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  -moz-transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;
  opacity: 0;

  z-index: 5;
}

.ProseMirror-tooltip-pointer-above {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid #333;
}

.ProseMirror-tooltip-pointer-right {
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-right: 6px solid #333;
}

.ProseMirror-tooltip-pointer-left {
  border-top: 6px solid transparent;
  border-bottom: 6px solid transparent;
  border-left: 6px solid #333;
}

.ProseMirror-tooltip input[type="text"],
.ProseMirror-tooltip textarea {
  background: #555;
  color: white;
  border: none;
  outline: none;
}

.ProseMirror-tooltip input[type="text"] {
  padding: 0 4px;
}

`)
