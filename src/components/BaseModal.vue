<template>
  <dialog
    ref="dialogRef"
    :aria-labelledby="titleId"
    :closedby="dismissible ? 'any' : 'none'"
    class="w-full p-3 sm:p-4 bg-transparent border-0 outline-none"
    :class="maxWidthClass"
    @close="handleNativeClose"
    @cancel="handleNativeCancel"
  >
    <div
      class="card-surface border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] w-full text-slate-900 dark:text-slate-100"
    >
      <div class="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <h2 :id="titleId" class="text-base font-bold truncate">
            {{ title }}
          </h2>
          <p v-if="subtitle" class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {{ subtitle }}
          </p>
        </div>
        <button
          type="button"
          @click="requestClose"
          class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          aria-label="Close dialog"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="p-4 sm:p-5 overflow-y-auto scroller space-y-4">
        <slot />
      </div>

      <div
        v-if="$slots.footer"
        class="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-end gap-2"
      >
        <slot name="footer" />
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { X } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    subtitle?: string;
    maxWidthClass?: string;
    dismissible?: boolean;
  }>(),
  {
    subtitle: '',
    maxWidthClass: 'max-w-lg',
    dismissible: true,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;

let pressedOutside = false;

function isOutsideDialogBox(e: PointerEvent, el: HTMLDialogElement): boolean {
  const r = el.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

function onPointerDown(e: PointerEvent) {
  if (!props.dismissible || !dialogRef.value) return;
  if ('closedBy' in HTMLDialogElement.prototype) return;
  pressedOutside = isOutsideDialogBox(e, dialogRef.value);
}

function onPointerUp(e: PointerEvent) {
  if (!props.dismissible || !dialogRef.value) return;
  if ('closedBy' in HTMLDialogElement.prototype) return;
  if (pressedOutside && isOutsideDialogBox(e, dialogRef.value)) {
    requestClose();
  }
  pressedOutside = false;
}

function syncDialogOpen(open: boolean) {
  const el = dialogRef.value;
  if (!el) return;
  if (open) {
    if (!el.open) {
      el.showModal();
    }
  } else if (el.open) {
    el.close();
  }
}

function requestClose() {
  emit('update:modelValue', false);
}

function handleNativeClose() {
  const el = dialogRef.value;
  if (el) el.returnValue = '';
  if (props.modelValue) {
    emit('update:modelValue', false);
  }
}

function handleNativeCancel(e: Event) {
  if (!props.dismissible) {
    e.preventDefault();
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    await nextTick();
    syncDialogOpen(open);
  },
  { immediate: true }
);

onMounted(() => {
  const el = dialogRef.value;
  if (el) {
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    if (props.modelValue) syncDialogOpen(true);
  }
});

onUnmounted(() => {
  const el = dialogRef.value;
  if (el) {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointerup', onPointerUp);
  }
});
</script>
