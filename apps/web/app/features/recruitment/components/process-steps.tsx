export interface ProcessStep {
  title: string;
  description: string;
}
export function ProcessSteps({ steps }: { steps: readonly ProcessStep[] }) {
  return (
    <ol className="process-steps">
      {steps.map((step, index) => (
        <li key={step.title}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
