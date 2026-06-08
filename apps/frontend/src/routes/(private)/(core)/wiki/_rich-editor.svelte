<script lang="ts">
  import { Tipex, defaultExtensions } from '@friendofsvelte/tipex';
  import { TextStyle } from '@tiptap/extension-text-style';
  import { TextAlign } from '@tiptap/extension-text-align';
  import { Color } from '@tiptap/extension-color';
  import { Highlight } from '@tiptap/extension-highlight';
  import { Table } from '@tiptap/extension-table';
  import { TableRow } from '@tiptap/extension-table-row';
  import { TableHeader } from '@tiptap/extension-table-header';
  import { TableCell } from '@tiptap/extension-table-cell';

  import Toolbar from './create/[id]/_toolbar.svelte';
  import { CalloutExtension } from './create/[id]/_callout-extension.js';
  import { KbRefExtension } from './create/[id]/_kb-ref-extension.js';
  import KbRefPopover from './_kb-ref-popover.svelte';

  let {
    html = $bindable('<p></p>'),
    class: className = '',
    onchange = () => {},
  } = $props<{
    html?: string;
    class?: string;
    onchange?: () => void;
  }>();

  const extensions = [
    ...defaultExtensions,
    TextStyle,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Color,
    Highlight.configure({ multicolor: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    CalloutExtension,
    KbRefExtension,
  ];
</script>

<KbRefPopover>
  <Tipex
    body={html}
    {extensions}
    class={className}
    onupdate={({ editor }) => {
      html = editor.getHTML();
      onchange();
    }}
  >
    {#snippet controlComponent(tipex)}
      <Toolbar {tipex} />
    {/snippet}
  </Tipex>
</KbRefPopover>
