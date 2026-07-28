import type { ModuleDoc } from './index'

export const aiDocs: ModuleDoc = {
  title: 'AI Intelligence',
  icon: 'ti-robot',
  color: '#A855F7',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The AI Intelligence module brings artificial intelligence capabilities into your real estate operations. It can analyze data, generate insights, and assist with decision-making.',
        'Use it to get predictive analytics, automated report summaries, and intelligent recommendations based on your business data.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'AI Assistant / Chat', desc: 'An interactive chat interface where you can ask questions about your data in natural language.' },
        { term: 'Insights', desc: 'Automatically generated observations about trends, anomalies, or patterns in your data.' },
        { term: 'Predictions', desc: 'AI-generated forecasts (e.g., predicted occupancy rates, rent trends, or maintenance needs).' },
        { term: 'Data Analysis', desc: 'AI processes your business data to produce summaries, charts, and actionable recommendations.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Opening AI Intel: Go to AI Intelligence from the sidebar or tools menu.',
        'Asking a Question: Type your question in natural language (e.g., "What was our total revenue last month?"). The AI processes and responds.',
        'Viewing Insights: The dashboard shows pre-generated insights. Click any insight to see details.',
        'Generating Reports: Ask the AI to create a report summary for a specific module or time period.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'AI pulls data from all modules to provide cross-module insights and analysis.',
        'Reports module can use AI-generated summaries as supplementary content.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'Is my data safe when using AI features?', desc: 'Yes. Data is processed within your system. No data is sent to external AI services unless explicitly configured.' },
        { term: 'How accurate are AI predictions?', desc: 'AI predictions are based on your historical data. Accuracy improves as more data is entered into the system.' },
        { term: 'Can the AI write data or make changes?', desc: 'The AI is currently read-only — it can analyze and suggest but cannot modify records directly.' },
      ],
    },
  ],
}
