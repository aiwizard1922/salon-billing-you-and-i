import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <section className="hero">
      <div className="hero-content">
        <h1>GemGlow Studio</h1>
        <p className="hero-sub">Handcrafted jewelry for every moment. Explore our collection and find your perfect piece.</p>
        <div className="hero-actions">
          <Link to="/products" className="btn-primary">Explore Collection</Link>
          <Link to="/signup" className="btn-outline">Get Started</Link>
        </div>
      </div>
    </section>
  );
}
