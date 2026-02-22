import m from 'mithril';

// Generic countdown timer component
// Attrs: deadline (Date), label (string, optional)
export const CountdownTimer = {
  oninit(vnode) {
    this.remaining = 0;
    this.interval = null;
    this.updateRemaining(vnode);
  },

  oncreate(vnode) {
    this.interval = setInterval(() => {
      this.updateRemaining(vnode);
      m.redraw();
    }, 250);
  },

  onupdate(vnode) {
    this.updateRemaining(vnode);
  },

  onremove() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  },

  updateRemaining(vnode) {
    const deadline = vnode.attrs.deadline;
    if (!deadline) {
      this.remaining = 0;
      return;
    }
    const deadlineTime = deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime();
    this.remaining = Math.max(0, Math.ceil((deadlineTime - Date.now()) / 1000));
  },

  view(vnode) {
    const label = vnode.attrs.label || 'Time';
    return m('span.countdown-timer', `${label}: ${this.remaining}s`);
  },
};
