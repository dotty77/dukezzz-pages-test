/* Pages supports browser-local file analysis; authenticated link reading stays on the main site. */
export function setupLinkImport() {
  const fileButton = document.getElementById('import-open');
  const link = document.createElement('a');
  link.id = 'link-open';
  link.className = 'primary-button pages-test-formal';
  link.textContent = '正式站链接导入 ↗';
  link.dataset.i18nEn = 'Import a link on the main site ↗';
  link.href = 'https://dukezzz.com/tuning.html';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  fileButton.before(link);
  fileButton.textContent = '导入文件';
  fileButton.dataset.i18nEn = 'Import file';
  return {isRunning: () => false};
}
