/*
 * App.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */


import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogBody,
  DialogActions,
  Button,
  Input,
  Label,
  makeStyles,
} from "@fluentui/react-components";
import React from 'react';

import { FluentProvider, webLightTheme } from '@fluentui/react-components';

const useStyles = makeStyles({
  content: {
    display: "flex",
    flexDirection: "column",
    rowGap: "10px",
  },
});

const App: React.FC = () => {
  const styles = useStyles();
  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    alert("form submitted!");
  };
  return (
    <FluentProvider theme={webLightTheme}>
      <Dialog modalType="modal">
        <DialogTrigger disableButtonEnhancement>
          <Button>Open formulary dialog</Button>
        </DialogTrigger>
        <DialogSurface aria-describedby={undefined}>
          <form onSubmit={handleSubmit}>
            <DialogBody>
              <DialogTitle>Dialog title</DialogTitle>
              <DialogContent className={styles.content}>
                <Label required htmlFor={"email-input"}>
                  Email input
                </Label>
                <Input required type="email" id={"email-input"} autoFocus={true}/>
                <Label required htmlFor={"password-input"}>
                  Password input
                </Label>
                <Input required type="password" id={"password-input"} />
              </DialogContent>
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary">Close</Button>
                </DialogTrigger>
                <Button type="submit" appearance="primary">
                  Submit
                </Button>
              </DialogActions>
            </DialogBody>
          </form>
        </DialogSurface>
      </Dialog>
    </FluentProvider>
  );
}

export default App;

