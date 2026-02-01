const secure = window.location.protocol == "https:" ? "s" : "";
export const wsScheme = `ws${secure}`;
export const httpScheme = `http${secure}`;

export const baseUrl = window.location.href
  .replace(/^https?:\/\//, "")
  .replace(/\/.*?\.html.*$/, "")
  .replace(/\/$/, "");

export function randomUUID() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function timeAgoString(fromDate) {
  const numberSuffix = (value) => (value == 1 ? "" : "s");

  const now = new Date();
  const secondsAgo = parseInt((now.getTime() - fromDate.getTime()) / 1000);
  if (secondsAgo < 60) {
    return `${secondsAgo} second${numberSuffix(secondsAgo)} ago`;
  } else if (secondsAgo < 3600) {
    const minutesAgo = parseInt(secondsAgo / 60);
    return `${minutesAgo} minute${numberSuffix(minutesAgo)} ago`;
  } else if (secondsAgo < 86400) {
    const hoursAgo = parseInt(secondsAgo / 3600);
    return `${hoursAgo} hour${numberSuffix(hoursAgo)} ago`;
  } else {
    return fromDate.toDateString();
  }
}

export function bitrateToString(bitrate) {
  if (bitrate < 1000) {
    return `${bitrate} bps`;
  } else if (bitrate < 1000000) {
    let bitrateKbps = (bitrate / 1000).toFixed(1);
    return `${bitrateKbps} kbps`;
  } else {
    let bitrateMbps = (bitrate / 1000000).toFixed(1);
    return `${bitrateMbps} Mbps`;
  }
}

export function bytesToString(bytes) {
  if (bytes < 1000) {
    return `${bytes} B`;
  } else if (bytes < 1000000) {
    const bytesKb = (bytes / 1000).toFixed(1);
    return `${bytesKb} kB`;
  } else if (bytes < 1000000000) {
    const bytesMb = (bytes / 1000000).toFixed(1);
    return `${bytesMb} MB`;
  } else {
    const bytesGb = (bytes / 1000000000).toFixed(1);
    return `${bytesGb} GB`;
  }
}

export function getTableBody(id) {
  const table = document.getElementById(id);
  while (table.rows.length > 1) {
    table.deleteRow(-1);
  }
  return table.tBodies[0];
}

export function appendToRow(row, value) {
  const cell = row.insertCell(-1);
  cell.innerHTML = value;
}

export function addOnClick(elementId, func) {
  document.getElementById(elementId).addEventListener("click", func);
}
