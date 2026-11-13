// Iconoir line drawings throughout; Icon.module.css thickens their stroke to match the app's type
import archive from "iconoir/icons/regular/archive.svg?raw";
import checkCircle from "iconoir/icons/regular/check-circle.svg?raw";
import clock from "iconoir/icons/regular/clock.svg?raw";
import computer from "iconoir/icons/regular/computer.svg?raw";
import copy from "iconoir/icons/regular/copy.svg?raw";
import download from "iconoir/icons/regular/download.svg?raw";
import editPencil from "iconoir/icons/regular/edit-pencil.svg?raw";
import emptyPage from "iconoir/icons/regular/empty-page.svg?raw";
import fileNotFound from "iconoir/icons/regular/file-not-found.svg?raw";
import folder from "iconoir/icons/regular/folder.svg?raw";
import folderPlus from "iconoir/icons/regular/folder-plus.svg?raw";
import halfMoon from "iconoir/icons/regular/half-moon.svg?raw";
import infoCircle from "iconoir/icons/regular/info-circle.svg?raw";
import lock from "iconoir/icons/regular/lock.svg?raw";
import logOut from "iconoir/icons/regular/log-out.svg?raw";
import mediaImage from "iconoir/icons/regular/media-image.svg?raw";
import mediaVideo from "iconoir/icons/regular/media-video.svg?raw";
import multiplePages from "iconoir/icons/regular/multiple-pages.svg?raw";
import musicNote from "iconoir/icons/regular/music-note.svg?raw";
import navArrowDown from "iconoir/icons/regular/nav-arrow-down.svg?raw";
import navArrowRight from "iconoir/icons/regular/nav-arrow-right.svg?raw";
import pagePlus from "iconoir/icons/regular/page-plus.svg?raw";
import play from "iconoir/icons/regular/play.svg?raw";
import plus from "iconoir/icons/regular/plus.svg?raw";
import prohibition from "iconoir/icons/regular/prohibition.svg?raw";
import sendDiagonal from "iconoir/icons/regular/send-diagonal.svg?raw";
import sunLight from "iconoir/icons/regular/sun-light.svg?raw";
import trash from "iconoir/icons/regular/trash.svg?raw";
import undo from "iconoir/icons/regular/undo.svg?raw";
import upload from "iconoir/icons/regular/upload.svg?raw";
import user from "iconoir/icons/regular/user.svg?raw";
import warningCircle from "iconoir/icons/regular/warning-circle.svg?raw";
import xmark from "iconoir/icons/regular/xmark.svg?raw";
import styles from "./Icon.module.css";

/** Every Iconoir icon the app uses. Only these are bundled; add one by importing it here */
const ICONS = {
  archive,
  "check-circle": checkCircle,
  clock,
  computer,
  copy,
  download,
  "edit-pencil": editPencil,
  "empty-page": emptyPage,
  "file-not-found": fileNotFound,
  folder,
  "folder-plus": folderPlus,
  "half-moon": halfMoon,
  "info-circle": infoCircle,
  lock,
  "log-out": logOut,
  "media-image": mediaImage,
  "media-video": mediaVideo,
  "multiple-pages": multiplePages,
  "music-note": musicNote,
  "nav-arrow-down": navArrowDown,
  "nav-arrow-right": navArrowRight,
  "page-plus": pagePlus,
  play,
  plus,
  prohibition,
  "send-diagonal": sendDiagonal,
  "sun-light": sunLight,
  trash,
  undo,
  user,
  upload,
  "warning-circle": warningCircle,
  xmark,
};

export type IconName = keyof typeof ICONS;

/** Decorative: give the surrounding control its own accessible name */
export function Icon(props: { name: IconName; class?: string }) {
  return <span class={[styles.icon, props.class]} aria-hidden="true" innerHTML={ICONS[props.name]} />;
}
