import { Activity, Bot, Rocket } from 'lucide-react';
import { useState, type JSX } from 'react';
import { FocusTrap } from './FocusTrap';

interface Props {
  onComplete(): void;
}

const steps = [
  {
    icon: Activity,
    title: 'Welcome to Command Center',
    body: 'Your mission control for orchestrating autonomous AI agents. Create missions, assign tasks, and let agents execute them — all from one dashboard.'
  },
  {
    icon: Bot,
    title: 'Agents are ready to work',
    body: 'Three agents are pre-configured: Planner, Builder, and Reviewer. Browse the Marketplace to install more runners, or configure custom agents in Settings.'
  },
  {
    icon: Rocket,
    title: 'Launch your first mission',
    body: 'Head to Mission Control to create a mission and dispatch your first agent run. Use one-click tasks for common operations, or create custom tasks with specific prompts.'
  }
];

export function WelcomeModal({ onComplete }: Props): JSX.Element {
  const [step, setStep] = useState(0);

  function handleNext(): void {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  }

  const current = steps[step];
  const Icon = current.icon;

  return (
    <div className="onboarding-overlay" role="presentation">
      <FocusTrap>
        <div className="onboarding-modal" role="dialog" aria-labelledby="onboarding-title" aria-describedby="onboarding-body" aria-label="Welcome to Command Center">
          <Icon size={36} color="var(--accent)" aria-hidden="true" />
          <h2 id="onboarding-title">{current.title}</h2>
          <p id="onboarding-body">{current.body}</p>
          <div className="onboarding-steps" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((_, i) => (
              <span key={i} className={`onboarding-dot ${i === step ? 'active' : ''}`} aria-hidden="true" />
            ))}
          </div>
          <div className="onboarding-actions">
            {step > 0 && (
              <button className="secondary-button" onClick={() => setStep(step - 1)}>Back</button>
            )}
            <button className="primary-button" onClick={handleNext}>
              {step < steps.length - 1 ? 'Next' : 'Get started'}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
