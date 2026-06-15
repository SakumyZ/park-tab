<script lang="ts">
  type IconName =
    | 'archive'
    | 'archive-restore'
    | 'chevron-down'
    | 'edit'
    | 'chevron-up'
    | 'external-link'
    | 'grip-vertical'
    | 'lock'
    | 'refresh'
    | 'restore'
    | 'settings'
    | 'trash'
    | 'unlock'
    | 'x'

  export let name: IconName
  export let className = 'h-4 w-4'
  export let title = ''
</script>

{#if name === 'settings'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <path
      d="M12 3a2.25 2.25 0 0 1 2.18 1.68l.14.52a1.5 1.5 0 0 0 2.07.98l.48-.22a2.25 2.25 0 0 1 2.77.61l.5.68a2.25 2.25 0 0 1-.28 2.82l-.38.38a1.5 1.5 0 0 0 0 2.12l.38.38a2.25 2.25 0 0 1 .28 2.82l-.5.68a2.25 2.25 0 0 1-2.77.61l-.48-.22a1.5 1.5 0 0 0-2.07.98l-.14.52a2.25 2.25 0 0 1-2.18 1.68h-.84a2.25 2.25 0 0 1-2.18-1.68l-.14-.52a1.5 1.5 0 0 0-2.07-.98l-.48.22a2.25 2.25 0 0 1-2.77-.61l-.5-.68a2.25 2.25 0 0 1 .28-2.82l.38-.38a1.5 1.5 0 0 0 0-2.12l-.38-.38a2.25 2.25 0 0 1-.28-2.82l.5-.68a2.25 2.25 0 0 1 2.77-.61l.48.22a1.5 1.5 0 0 0 2.07-.98l.14-.52A2.25 2.25 0 0 1 11.16 3H12Z"
    />
    <circle cx="12" cy="12" r="3" />
  </svg>
{:else if name === 'chevron-down'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
{:else if name === 'chevron-up'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
{:else if name === 'restore'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <path d="M3 10h6V4" />
    <path d="M3 10a9 9 0 1 0 2.64-6.36L9 6" />
  </svg>
{:else if name === 'lock'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <rect width="18" height="11" x="3" y="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
{:else if name === 'unlock'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <rect width="18" height="11" x="3" y="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 9.8-1" />
  </svg>
{:else if name === 'archive'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <rect width="20" height="5" x="2" y="3" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
{:else if name === 'archive-restore'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <rect width="20" height="5" x="2" y="3" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M12 17V11" />
    <path d="m9 14 3-3 3 3" />
  </svg>
{:else if name === 'trash'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
{:else if name === 'external-link'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
{:else if name === 'edit'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
{:else if name === 'grip-vertical'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
{:else if name === 'refresh'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
{:else if name === 'x'}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    class={className}
    aria-hidden={!title}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
{/if}
