import { json, urlencoded } from "body-parser";
import express from "express";
import morgan from "morgan";
import cors from "cors";

import { EditorDataCiteServer } from 'editor-server'

export const createServer = () => {
  const app = express();
  app
    .disable("x-powered-by")
    .use(morgan("dev"))
    .use(urlencoded({ extended: true }))
    .use(json())
    .use(cors())
    .get("/datacite", async (_req, res) => {
      const server = new EditorDataCiteServer();
      return res.json(await server.search(''));
    })
    .get("/message/:name", (req, res) => {
      return res.json({ message: `hello ${req.params.name}` });
    })
    .get("/healthz", (_req, res) => {
      return res.json({ ok: true });
    });

  return app;
};
