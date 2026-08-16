export default function WorkspaceLoading() {
  return (
    <main className="v3-workspace-loading" aria-busy="true" aria-label="Loading workspace">
      <aside className="v3-workspace-loading__side">
        <div className="v3-skel v3-skel--brand" />
        <div className="v3-skel v3-skel--cta" />
        <div className="v3-skel v3-skel--nav" />
        <div className="v3-skel v3-skel--nav" />
        <div className="v3-skel v3-skel--nav" />
        <span style={{ flex: 1 }} />
        <div className="v3-skel v3-skel--status" />
      </aside>
      <section className="v3-workspace-loading__main">
        <div className="v3-skel v3-skel--topbar" />
        <div className="v3-workspace-loading__content">
          <div className="v3-skel v3-skel--hero" />
          <div className="v3-skel v3-skel--grid" />
        </div>
      </section>
    </main>
  );
}
