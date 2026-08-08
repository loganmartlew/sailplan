import { useState } from 'react';
import { FieldError } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { FormControlWrapper } from '~/components/form';
import {
  Button,
  Select,
  Text,
  ToggleGroup,
  ToggleGroupItem,
} from '~/components/ui';
import { Coordinate } from '~/features/coordinate';
import { SelectLocationDialog } from '~/features/map';
import { Mark, useMarks } from '~/features/mark';

export const customLocationSchema = z
  .object({
    locationType: z.enum(['none', 'mark', 'custom']),
    markId: z.number().nullable(),
    location: z
      .object({
        latitude: z.number().min(-90).max(90, {
          message: 'Latitude must be between -90 and 90',
        }),
        longitude: z.number().min(-180).max(180, {
          message: 'Longitude must be between -180 and 180',
        }),
      })
      .nullable(),
  })
  .refine(data => data.locationType !== 'mark' || data.markId !== null, {
    message: 'Mark is required',
  })
  .refine(data => data.locationType !== 'custom' || data.location !== null, {
    message: 'Location is required',
  });

export type CustomLocationData = z.infer<typeof customLocationSchema>;

interface CustomLocationProps {
  label: string;
  name: string;
  error?: FieldError;
  value: CustomLocationData | null;
  onChange: (locationData: CustomLocationData | null) => void;
  mapMarks?: Mark[];
}

export function CustomLocation({
  label,
  name,
  error,
  value,
  onChange,
  mapMarks = [],
}: CustomLocationProps) {
  const [locationType, setLocationType] = useState<'none' | 'mark' | 'custom'>(
    'none',
  );
  const [selectLocationDialogOpen, setSelectLocationDialogOpen] =
    useState(false);

  const onTypeChange = (value: 'none' | 'mark' | 'custom' | null) => {
    if (!value) return;
    setLocationType(value);

    if (value === 'none') {
      onChange(null);
    } else {
      onChange({
        locationType: value,
        markId: null,
        location: null,
      });
    }
  };

  const { data: marks } = useMarks();

  const markOptions =
    marks?.map(mark => ({
      label: mark.name,
      value: mark.id.toString(),
    })) ?? [];

  return (
    <View className='flex gap-2'>
      <FormControlWrapper label={label} name={name} error={error}>
        <ToggleGroup
          type='single'
          value={locationType}
          onValueChange={value =>
            onTypeChange(value as 'none' | 'mark' | 'custom' | null)
          }
        >
          <ToggleGroupItem value='none' className='grow'>
            <Text>None</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='mark' className='grow'>
            <Text>Mark</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value='custom' className='grow'>
            <Text>Custom</Text>
          </ToggleGroupItem>
        </ToggleGroup>
        {locationType === 'mark' && (
          <FormControlWrapper
            label='Select Mark'
            name={`${name}.markId`}
            className='mt-2'
          >
            <Select
              value={value?.markId?.toString()}
              options={markOptions}
              onValueChange={value => {
                const id = value ? parseInt(value, 10) : null;
                onChange({
                  locationType: 'mark',
                  markId: id,
                  location: null,
                });
              }}
            />
          </FormControlWrapper>
        )}
        {locationType === 'custom' && (
          <Button
            variant='outline'
            className='mt-2'
            onPress={() => setSelectLocationDialogOpen(true)}
          >
            <Text>
              {value?.location ? 'Location Selected' : 'Select Location'}
            </Text>
          </Button>
        )}
      </FormControlWrapper>
      <SelectLocationDialog
        open={selectLocationDialogOpen}
        onOpenChange={setSelectLocationDialogOpen}
        onSelectLocation={(location: Coordinate) => {
          onChange({
            locationType: 'custom',
            markId: null,
            location: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
          });
          setSelectLocationDialogOpen(false);
        }}
        marks={mapMarks}
      />
    </View>
  );
}
