import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import {SettingsApp} from './Settings.jsx';
import {DisplayApp} from './Display.jsx';
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).get('view')==='settings'?<SettingsApp/>:new URLSearchParams(location.search).get('view')==='display'?<DisplayApp/>:<App/>}
  </React.StrictMode>,
);
