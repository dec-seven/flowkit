<template>
  <main class="app">
    <h1>FlowKit 审批中心</h1>
    <div class="layout">
      <ApprovalTaskList :client="client" @select="selected = $event" />
      <section class="detail">
        <ApprovalDetail :client="client" :task="selected" />
        <ApprovalActionBar v-if="selected" :client="client" :task="selected" />
        <ApprovalTimeline :history="snapshot.history" />
      </section>
    </div>
  </main>
</template>
<script>
export default { name: 'App', props: { client: Object }, data: () => ({ selected: null, snapshot: { history: [] } }), created() { this.snapshot = this.client.getSnapshot(); this.unsubscribe = this.client.subscribe((state) => { this.snapshot = state; this.selected = state.selectedTask || this.selected; }); }, beforeDestroy() { this.unsubscribe?.(); } };
</script>
<style>
body { margin: 0; background: #f5f7fb; font-family: system-ui, sans-serif; color: #1f2937; }
.app { max-width: 1080px; margin: 0 auto; padding: 32px; } h1 { margin-top: 0; }
.layout { display: grid; grid-template-columns: 320px 1fr; gap: 20px; } .layout > *, .detail { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px #0000000d; }
button { display: block; width: 100%; margin: 8px 0; padding: 10px; border: 1px solid #dbe2ea; border-radius: 6px; background: white; cursor: pointer; text-align: left; } button:hover { border-color: #2563eb; }
textarea { width: 100%; min-height: 60px; margin: 16px 0 8px; box-sizing: border-box; } ol { padding-left: 20px; }
</style>
