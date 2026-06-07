import { useEffect, useState } from 'react';
import Desktop from './components/Desktop';

export default function App(): React.JSX.Element {
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 1500);
    return () => window.clearTimeout(timer);
  }, []);

  if (booting) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <h1>VibeOS</h1>
          <p>Loading hallucinated drivers...</p>
          <p>Starting isolated app sessions...</p>
          <div className="boot-bar">
            <span />
          </div>
        </div>
      </div>
    );
  }

  return <Desktop />;
}
