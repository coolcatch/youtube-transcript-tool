import UrlForm from "@/components/UrlForm";

export default function Home() {
  return (
    <div className="home">
      <section className="hero">
        <h1>YouTube Transcript Generator</h1>
        <p className="lead">Paste a YouTube link and get the full transcript in seconds. Free, no sign-up, no ads.</p>
        <UrlForm />
        <p className="hint">Works with watch links, youtu.be, Shorts, embeds and plain video IDs.</p>
      </section>

      <section className="features" aria-label="Features">
        <div className="feature">
          <h2>Copy in one click</h2>
          <p>Clean paragraphs, ready for notes, blog posts or AI prompts.</p>
        </div>
        <div className="feature">
          <h2>Download any format</h2>
          <p>.txt, .srt and .vtt subtitles, or .json with every timestamp.</p>
        </div>
        <div className="feature">
          <h2>Timestamps &amp; languages</h2>
          <p>Show clickable timestamps, and switch between caption languages.</p>
        </div>
      </section>
    </div>
  );
}
