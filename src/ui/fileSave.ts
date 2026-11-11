/** 'saved' when the file was handed to the OS (download or share sheet); 'cancelled' if dismissed. */
export async function saveFile(
  filename: string,
  content: string,
  mime: string,
): Promise<'saved' | 'cancelled'> {
  const blob = new Blob([content], { type: mime });
  // On phones (notably installed iOS PWAs) the share sheet is the reliable way to save to Files.
  const file = new File([blob], filename, { type: mime });
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'saved';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'saved';
}
