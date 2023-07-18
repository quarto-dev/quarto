


declare module 'positron' {

	import * as vscode from 'vscode';

	export interface PositronApi {
		version: string;
		runtime: PositronRuntime;
		window: PositronWindow;
	}

	export interface PositronRuntime {
		executeCode(
			languageId: string,
			code: string,
			focus: boolean
		): Thenable<boolean>;
	}

	export interface PositronWindow {
		createPreviewPanel(
			viewType: string, 
			title: string, 
			preserveFocus?: boolean, 
			options?: PreviewOptions
		): PreviewPanel;
	}

	export interface PreviewOptions {
		readonly enableScripts?: boolean;
		readonly enableForms?: boolean;
		readonly localResourceRoots?: readonly vscode.Uri[];
		readonly portMapping?: readonly vscode.WebviewPortMapping[];
	}

	export interface PreviewPanel {
		readonly viewType: string;
		title: string;
		readonly webview: vscode.Webview;
		readonly active: boolean;
		readonly visible: boolean;
		readonly onDidChangeViewState: vscode.Event<PreviewPanelOnDidChangeViewStateEvent>;
		readonly onDidDispose: vscode.Event<void>;
		reveal(preserveFocus?: boolean): void;
		dispose(): any;
	}

	export interface PreviewPanelOnDidChangeViewStateEvent {
		readonly previewPanel: PreviewPanel;
	}
}



