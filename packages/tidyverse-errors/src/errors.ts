// tidyverse error message styling
// https://style.tidyverse.org/error-messages.html
//
// Currently, the only way in which we disagree with the tidyverse
// style guide is in the phrasing of the "hint" (here, "info") prompts.
// Instead of using question marks, we use actionable, but tentative phrasing.
//
// Where the style guide would suggest "have you tried x instead?"
//
// here, we will say "Try x instead."
//

import * as colors from "ansi-colors";

const getPlatform = () => {
  // Adapted from https://stackoverflow.com/a/19176790
  let OSName = "unknown";
  if (window.navigator.userAgent.indexOf("Windows NT 10.0")!== -1) OSName="windows";
  if (window.navigator.userAgent.indexOf("Windows NT 6.3") !== -1) OSName="windows";
  if (window.navigator.userAgent.indexOf("Windows NT 6.2") !== -1) OSName="windows";
  if (window.navigator.userAgent.indexOf("Windows NT 6.1") !== -1) OSName="windows";
  if (window.navigator.userAgent.indexOf("Windows NT 6.0") !== -1) OSName="windows";
  if (window.navigator.userAgent.indexOf("Windows NT 5.1") !== -1) OSName="windows";
  if (window.navigator.userAgent.indexOf("Windows NT 5.0") !== -1) OSName="windows";
  if (window.navigator.userAgent.indexOf("Mac")            !== -1) OSName="darwin";
  if (window.navigator.userAgent.indexOf("X11")            !== -1) OSName="linux";
  if (window.navigator.userAgent.indexOf("Linux")          !== -1) OSName="linux";
  
  return OSName;
}

function platformHasNonAsciiCharacters(): boolean {
  try {
    return getPlatform() !== "windows";
  } catch (_e) {
    return false;
  }
}

// formats an info message according to the tidyverse style guide
export function tidyverseInfo(msg: string) {
  if (platformHasNonAsciiCharacters()) {
    return `${colors.blue("ℹ")} ${msg}`;
  } else {
    return `${colors.blue("i")} ${msg}`;
  }
}

// formats an error message according to the tidyverse style guide
export function tidyverseError(msg: string) {
  if (platformHasNonAsciiCharacters()) {
    return `${colors.red("✖")} ${msg}`;
  } else {
    return `${colors.red("x")} ${msg}`;
  }
}

export interface ErrorLocation {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}

export interface TidyverseError {
  heading: string;
  error: string[];
  info: Record<string, string>; // use tag for infos to only display one error of each tag
  fileName?: string;
  location?: ErrorLocation;
  sourceContext?: string;
}

export function quotedStringColor(msg: string) {
  return colors.blue(msg);
}

