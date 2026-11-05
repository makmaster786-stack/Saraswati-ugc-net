/* Keep drawer state, keyboard focus and the overlay in sync. */
document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('sidebarToggleBtn');
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!button || !sidebar || !overlay) return;
    function setOpen(open) {
        document.body.classList.toggle('sidebar-open', open);
        button.setAttribute('aria-expanded', String(open));
        sidebar.setAttribute('aria-hidden', String(!open));
        sidebar.inert = !open;
        if (open) sidebar.querySelector('a')?.focus();
        else if (sidebar.contains(document.activeElement)) button.focus();
    }
    button.addEventListener('click', () => setOpen(!document.body.classList.contains('sidebar-open')));
    overlay.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', event => {
        if (!document.body.classList.contains('sidebar-open')) return;
        if (event.key === 'Escape') { setOpen(false); button.focus(); }
        if (event.key === 'Tab') {
            const links = [button, ...sidebar.querySelectorAll('a[href]')];
            if (event.shiftKey && document.activeElement === links[0]) {
                event.preventDefault(); links.at(-1).focus();
            } else if (!event.shiftKey && document.activeElement === links.at(-1)) {
                event.preventDefault(); button.focus();
            }
        }
    });
});
