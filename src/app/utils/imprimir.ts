/**
 * Dispara `window.print()` garantindo o tamanho/orientação de página corretos.
 *
 * `@page` não pode ser escopado por classe/seletor de elemento de forma confiável entre
 * navegadores (páginas nomeadas via `page:` existem, mas o Chrome não respeita o tamanho
 * delas de forma consistente dentro de um único documento). Por isso a orientação é
 * definida dinamicamente, injetando/atualizando um único `<style>` com a regra `@page`
 * certa imediatamente antes de imprimir — cada botão de imprimir da aplicação chama esta
 * função com a orientação que faz sentido para o conteúdo que ele mostra.
 */
export function imprimirComPagina(orientacao: 'portrait' | 'landscape', margemMm = 12) {
  let style = document.getElementById('print-page-size') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'print-page-size';
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: A4 ${orientacao}; margin: ${margemMm}mm; }`;
  window.print();
}
