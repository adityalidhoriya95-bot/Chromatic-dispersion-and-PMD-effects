### ## Introduction

When a light pulse travels through an optical fiber, it spreads out in time. This is called **dispersion**. If the pulses spread enough to overlap with their neighbours, the receiver cannot tell the bits apart, which causes errors. This experiment covers two types of dispersion: chromatic dispersion and polarization mode dispersion.

## Chromatic Dispersion (CD)

A real laser source is not perfectly single-wavelength. It has a small spectral width. Different wavelengths travel at different speeds in glass, so they arrive at slightly different times.

The pulse broadening is:

    Δτ_CD = D × L × Δλ

where
- D = dispersion parameter, in ps/(nm·km)
- L = fiber length, in km
- Δλ = spectral width of the source, in nm

For standard single-mode fiber at 1550 nm, D is about 17 ps/(nm·km). The dispersion is close to zero near 1310 nm.

## Polarization Mode Dispersion (PMD)

Light in a single-mode fiber has two orthogonal polarization modes. A real fiber is never perfectly round, and it is also affected by bending and stress. This makes the two modes travel at slightly different speeds (birefringence), and the pulse splits and broadens.

PMD is random along the fiber, so it grows with the square root of the length:

    Δτ_PMD = D_PMD × √L

where D_PMD is the PMD coefficient, in ps/√km. A typical value is about 0.1 ps/√km.

## Effect of Data Rate

The bit period is:

    T = 1 / B

where B is the bit rate. At 100 Gb/s, T = 10 ps. A common rule of thumb is that the total pulse broadening should stay below about T/4 for the link to work well. A higher data rate means a shorter bit period, so the fiber can tolerate less dispersion.

## Summary

| Property | Chromatic Dispersion | PMD |
|---|---|---|
| Cause | Different wavelengths travel at different speeds | Two polarization modes travel at different speeds |
| Grows with length as | L | √L |
| Nature | Deterministic | Random |
| Unit | ps/(nm·km) | ps/√km |