import React from 'react';
import { Composition } from 'remotion';
import { ProjectDeskDeployment } from './Composition';
import { LinguaDeskDeploymentPortrait } from './CompositionPortrait';

export const Root: React.FC = () => {
  return (
    <>
      {/* 45-second 1920x1080 Landscape Composition */}
      <Composition
        id="ProjectDeskDeployment"
        component={ProjectDeskDeployment}
        durationInFrames={1350}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* 20-second 1290x2796 iPhone 18 Pro Max Portrait Composition */}
      <Composition
        id="LinguaDeskDeploymentPortrait"
        component={LinguaDeskDeploymentPortrait}
        durationInFrames={600}
        fps={30}
        width={1290}
        height={2796}
      />
    </>
  );
};
