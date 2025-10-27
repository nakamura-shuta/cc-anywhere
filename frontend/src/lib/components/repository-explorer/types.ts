export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
  children?: TreeNode[];
  isDeleted?: boolean; // 削除されたファイル/ディレクトリを示すフラグ
}

export interface FileContent {
  path: string;
  content: string;
  encoding: 'utf8' | 'base64' | 'binary';
  size: number;
  mimeType: string;
  language?: string;
  modifiedAt: string;
}

export interface RepositoryExplorerProps {
  repositories: Array<{ name: string; path: string }>;
  position?: 'bottom' | 'side' | 'modal';
  layout?: 'horizontal' | 'vertical' | 'tabs';
  showHeader?: boolean;
  collapsible?: boolean;
  onFileSelect?: (repository: string, filePath: string) => void;
  // URLパラメータで初期表示するファイル
  initialFile?: string;
  // URL同期を有効にするか（ファイル選択時にURLを更新）
  syncWithUrl?: boolean;
}

export interface FileTreeProps {
  repositories: Array<{ name: string; path: string }>;
  onFileSelect: (repository: string, filePath: string) => void;
  selectedFile?: { repository: string; path: string };
}

export interface FileTreeNodeProps {
  node: TreeNode;
  repository: string;
  level: number;
  onFileSelect: (repository: string, filePath: string) => void;
  selectedPath?: string;
}

export interface FileViewerProps {
  repository: string;
  filePath: string;
  onClose?: () => void;
}