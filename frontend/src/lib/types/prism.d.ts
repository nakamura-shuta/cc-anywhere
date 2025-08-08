declare global {
	interface Window {
		Prism?: {
			highlightElement: (element: HTMLElement) => void;
		};
	}
}

export {};